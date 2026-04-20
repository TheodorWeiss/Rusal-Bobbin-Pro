import React, { useState } from 'react';
import Bobbin from './Bobbin';
import './App.css';

function App() {
    const [jsonData, setJsonData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [ordersFile, setOrdersFile] = useState(null);
    const [referenceFile, setReferenceFile] = useState(null);


    const handleOrdersSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
        setOrdersFile(e.target.files[0]);
    }
    };

    const handleReferenceSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            setReferenceFile(e.target.files[0]);
            setError('');
        }
    };

    const handleUpload = async () => {
        if (!ordersFile || !referenceFile) {
            setError('Пожалуйста, выберите CSV и EXСEL файлы');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('orders', ordersFile);
        formData.append('reference', referenceFile);

        try {
            const response = await fetch('http://127.0.0.1:5001/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Ошибка сервера: ${response.status}`);
            }

            const data = await response.json();
            setJsonData(data);
        } catch (err) {
            setError(`Ошибка: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };


    const summary = jsonData?.summary || null;
    const bobbins = jsonData?.bobbins || [];

    return (
        <div className="app">
            <h1>РУСАЛ — Раскрой фольги</h1>

            <div className="upload-section">
                <div className= "file-input-group">
                    <span style={{fontSize: '12px', color: '#666'}}>Заказы (CSV/Excel): </span>
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleOrdersSelect}
                        disabled={loading}
                />
                </div>

                <div className="file-input-group">
                    <span style={{fontSize: '12px', color: '#666'}}>Справочник (CSV/Excel):</span>
                    <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleReferenceSelect}
                    disabled={loading}
                />
                </div>

                <button onClick={handleUpload} disabled={!ordersFile || !referenceFile || loading}>
                    {loading ? 'Обработка…' : 'Отправить'}
                </button>
                {ordersFile && referenceFile && !loading && (
                    <span className="filename">📄 {ordersFile.name} и {referenceFile.name}</span>
                )}
            </div>

            {loading && <div className="loading">⏳ Загрузка…</div>}
            {error && <div className="error">{error}</div>}

            {jsonData && (
                <>
                    <div className="metrics">
                        <h3>Сводные метрики</h3>
                        <div className="metrics-grid">
                            <div className="metric-card">
                                <div className="metric-value">{summary?.total_bobbins || bobbins.length}</div>
                                <div className="metric-label">Бобин</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-value">{summary?.total_orders || 0}</div>
                                <div className="metric-label">Всего заказов</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-value">{summary?.total_useful_area_m2?.toFixed(1) || 0} м²</div>
                                <div className="metric-label">Полезная площадь</div>
                            </div>
                            <div className="metric-card metric-card--highlight">
                                <div className="metric-value">{summary?.overall_waste_percentage?.toFixed(1) || 0}%</div>
                                <div className="metric-label">Общий % обрезков</div>
                            </div>
                        </div>
                    </div>

                    <Bobbin data={jsonData} />
                </>
            )}
        </div>
    );
}

export default App;