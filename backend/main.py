import pandas as pd
import json
import os
from datetime import datetime
import io

class ProcutterEngine:
    def __init__(self):
        self.BOBBIN_WIDTH = 1500
        self.EDGE_TRIM = 20
        self.BOBBIN_MAX_LENGTH_M = 1000
        self.max_y_mm = self.BOBBIN_MAX_LENGTH_M * 1000
        self.INTER_CUT_MAP = {}

    def load_data(self, data_input):
        """Загрузка данных из Excel/CSV (принимает путь или объект файла)"""

        try:
            if not isinstance(data_input, str):
                content = data_input.read()
                if data_input.filename.endswith('.csv'):
                    df = pd.read_csv(io.StringIO(content.decode('utf-8')), decimal=',')
                else:
                    df = pd.read_excel(io.BytesIO(content), decimal=',')

            column_mapping = {
                'Номер заказа': 'order_id',
                'Сплав': 'alloy',
                'Толщина материала (мкм)': 'raw_thick',
                'Ширина листа заказа (мм)': 'width',
                'Длина листа заказа (м)': 'height',
                'Очередность заказа': 'priority'
            }
            df = df.rename(columns=column_mapping)
            #new_cols = ['order_id', 'alloy', 'raw_thick', 'width', 'height', 'priority']
            #df.columns = new_cols[:len(df.columns)]

            df['thickness_um'] = pd.to_numeric(df['raw_thick'], errors='coerce').astype(float)
            df['width'] = pd.to_numeric(df['width'], errors='coerce').fillna(0)
            df['height'] = pd.to_numeric(df['height'], errors='coerce').fillna(0) * 1000
            df['priority'] = pd.to_numeric(df['priority'], errors='coerce').fillna(1)
            return df
        except Exception as e:
            print(f"Ошибка при загрузке файла заказов: {e}")
            return None

    def load_intercut_map(self, file_input):
        """Загрузка справочника из Excel/CSV (принимает путь или объект файла)"""
        try:
            if not isinstance(file_input, str):
                content = file_input.read()
                if file_input.filename.endswith('.csv'):
                    file_input = io.StringIO(content.decode('utf-8'))
                    df = pd.read_csv(file_input, sep=None, engine='python', encoding='utf-8')
                else:
                    file_input = io.BytesIO(content)
                    df = pd.read_excel(file_input)

            new_map = {}
            for _, row in df.iterrows():
                alloy = str(row.iloc[0]).strip()
                thick = float(row.iloc[1])
                if thick < 1: thick *= 1000
                cut = int(row.iloc[2])
                new_map[(alloy, round(thick, 2))] = cut
            self.INTER_CUT_MAP = new_map
        except Exception as e:
            print(f"Ошибка при чтении файла справочника: {e}")

    def pack_orders(self, df):
        limit_y = self.max_y_mm
        results = {
            "instruction_metadata": {
                "batch_id": f"TASK-{datetime.now():%Y%m%d}",
                "timestamp": datetime.now().isoformat(),
                "factory": "САЗ",
                "machine_id": "MILL-05"
            },
            "bobbins": []
        }

    # Накопители для итогового summary
        total_useful_area_mm2 = 0
        total_orders_count = 0
        total_bobbin_area_mm2 = 0

        groups = df.groupby(['alloy', 'thickness_um'])
        for (alloy, thick), group in groups:
            inter_cut = self.INTER_CUT_MAP.get((str(alloy), round(float(thick), 2)), 6)
            all_orders = group.to_dict('records')

        # Очереди приоритетов
            p1 = sorted([o for o in all_orders if int(o['priority']) == 1], key=lambda x: int(x['height']), reverse=True)
            p2 = sorted([o for o in all_orders if int(o['priority']) == 2], key=lambda x: int(x['width']) * int(x['height']), reverse=True)
            p3 = sorted([o for o in all_orders if int(o['priority']) == 3], key=lambda x: int(x['width']) * int(x['height']), reverse=True)
            queues = [p1, p2, p3]

            while any(queues):
                current_items = []
                current_y, current_x, shelf_h = 0, self.EDGE_TRIM, 0
                bobbin_used_area_mm2 = 0

            # ОСНОВНОЙ ЦИКЛ УПАКОВКИ (из стабильной версии)
                while current_y < limit_y:
                    best_item = None
                    found_in_q = None
                    rem_w = self.BOBBIN_WIDTH - self.EDGE_TRIM - current_x

                    for q_idx, queue in enumerate(queues):
                        if not queue: continue
                        for i, ord_item in enumerate(queue):
                            w_o, h_o = int(ord_item['width']), int(ord_item['height'])
                            for v_w, v_h in [(w_o, h_o), (h_o, w_o)]:
                                if v_w <= rem_w and (current_y + v_h) <= self.max_y_mm:
                                    if current_x > self.EDGE_TRIM and v_h > shelf_h:
                                        continue
                                    best_item = (i, ord_item, v_w, v_h)
                                    found_in_q = q_idx
                                    break
                            if best_item: break
                        if best_item: break

                    if best_item:
                        idx, ord_obj, target_w, target_h = best_item
                        queues[found_in_q].pop(idx)
                        current_items.append(self._format_item(ord_obj, target_w, target_h, current_x, current_y))
                        bobbin_used_area_mm2 += (target_w * target_h)
                        current_x += target_w + inter_cut

                        if current_x == (target_w + inter_cut + self.EDGE_TRIM):
                            shelf_h = target_h
                        else:
                            shelf_h = max(shelf_h, target_h)
                    else:
                        # Переход на новую полку
                        if shelf_h == 0: break
                        current_y += shelf_h + inter_cut
                        current_x, shelf_h = self.EDGE_TRIM, 0

                if current_items:
                    # Расчет площади и метрик бобины
                    full_area_mm2 = self.BOBBIN_WIDTH * self.max_y_mm
                    used_m2 = round(bobbin_used_area_mm2 / 1_000_000, 2)
                    # waste_m2 = round((full_area_mm2 - bobbin_used_area_mm2) / 1_000_000, 2)
                    # waste_pct = round((waste_m2 / (full_area_mm2 / 1_000_000)) * 100, 2)

                    results["bobbins"].append({
                        "bobbin_id": f"B-{alloy}-{thick}-{len(results['bobbins'])}",
                        "source_material": {
                            "alloy": str(alloy), "thickness_um": float(thick),
                            "bobbin_width_mm": self.BOBBIN_WIDTH, "bobbin_length_m": self.BOBBIN_MAX_LENGTH_M
                        },
                        "layout_configuration": {"inter_cut_mm": inter_cut, "edge_trim_mm": self.EDGE_TRIM},
                        "cutting_map": current_items,
                        "efficiency_metrics": {
                            "total_used_area_m2": used_m2,
                            "waste_area_m2": round((full_area_mm2 - bobbin_used_area_mm2) / 1_000_000, 2),
                            "waste_percentage": round(((full_area_mm2 - bobbin_used_area_mm2) / full_area_mm2) * 100, 2)
                    }
                })
                # Накапливаем данные для Summary
                total_useful_area_mm2 += bobbin_used_area_mm2
                total_orders_count += len(current_items)
                total_bobbin_area_mm2 += full_area_mm2

    # Финальный блок Summary (как в образце)
        results["summary"] = {
            "total_bobbins": len(results["bobbins"]),
            "total_orders": total_orders_count,
            "total_useful_area_m2": round(total_useful_area_mm2 / 1_000_000, 1),
            "total_bobbin_area_m2": round(total_bobbin_area_mm2 / 1_000_000, 1),
            "overall_waste_percentage": round((1 - (total_useful_area_mm2 / total_bobbin_area_mm2)) * 100, 2) if total_bobbin_area_mm2 > 0 else 0
        }
        return results


    def _format_item(self, ord, w, h, x, y):
        """Исправленная конвертация для фронтенда (X в мм, Y в метрах)"""
        return {
            "order_id": str(ord['order_id']),
            "type": "main" if int(ord['priority']) == 1 else "satellite",
            "priority": int(ord['priority']),
            "coordinates": {
                "x_start_mm": int(x),
                "y_start_m": round(float(y) / 1000, 3),
                "width_mm": int(w),
                "length_m": round(float(h) / 1000, 3)
            }
        }


if __name__ == "__main__":
    engine = ProcutterEngine()
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

    input_file = os.path.join(BASE_DIR, "table_orders.xlsx")
    intercut_file = os.path.join(BASE_DIR, "cutting_book.csv")

    if os.path.exists(intercut_file):
        engine.load_intercut_map(intercut_file)
        print(f"Справочник межкройных резов успешно загружен из {intercut_file}")
    else:
        print(f"Предупреждение: Файл '{intercut_file}' не найден. Будут использованы значения по умолчанию.")

    if os.path.exists(input_file):
        data = engine.load_data(input_file)

        if data is not None:
            # создает список bobbins, пока не кончатся заказы
            final_json = engine.pack_orders(data)

            if final_json and final_json.get('bobbins'):
                os.makedirs("output", exist_ok=True)

                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                file_name = f"plan_{timestamp}.json"
                save_path = os.path.join("output", file_name)

                # Сохранение результата
                with open(save_path, "w", encoding="utf-8") as f:
                    json.dump(final_json, f, ensure_ascii=False, indent=4)

                print(f"Успех! Результат сохранен: {save_path}")
                print(f"Всего сформировано бобин: {len(final_json['bobbins'])}")
            else:
                print("Внимание: Заказы загружены, но ни одна деталь не влезла на бобину.")
        else:
            print("Ошибка: Не удалось обработать содержимое файла заказов (df is None).")
    else:
        print(f" Ошибка: Файл заказов '{input_file}' не найден в корневой папке!")
