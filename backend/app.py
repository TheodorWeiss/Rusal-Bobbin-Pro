from flask import Flask, request, jsonify
from flask_cors import CORS
from main import ProcutterEngine

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Позволяет фронтенду общаться с бэкендом

engine = ProcutterEngine()

@app.route('/upload', methods=['POST'])
def upload():
  try:
    # Получаем файлы из FormData фронтенда
    orders_file = request.files.get('orders')   # Название из App.js
    reference_file = request.files.get('reference') # Название из App.js

    if not orders_file or not reference_file:
      return jsonify({"error": "Выберите оба файла!"}), 400

    # Используем обновленные методы
    engine.load_intercut_map(reference_file)
    df_orders = engine.load_data(orders_file)

    if df_orders is not None:
      # Выполняем расчет
      result = engine.pack_orders(df_orders)
      return jsonify(result)
    else:
      return jsonify({"error": "Не удалось обработать файл заказов"}), 400

  except Exception as e:
    return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
  app.run(host='127.0.0.1', port=5001, debug=True)
