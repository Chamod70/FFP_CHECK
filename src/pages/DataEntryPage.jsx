import React, { useState } from 'react';
import useStore from '../store';
import { parseTSV } from '../utils';

const SHEET_NAMES = ['H.COMP', 'MAST', 'WBT', 'WBT2', 'INS', 'EXT', 'RATE'];

function DataEntryPage() {
  const [activeTab, setActiveTab] = useState(SHEET_NAMES[0]);
  const [inputText, setInputText] = useState('');
  const { masterData, setMasterData } = useStore();

  const handleSave = () => {
    const parsedData = parseTSV(inputText);
    setMasterData(activeTab, parsedData);
    setInputText('');
    alert(`Data saved for ${activeTab}. Rows added: ${parsedData.length}`);
  };

  const activeDataLength = masterData[activeTab]?.length || 0;

  return (
    <div className="page-container">
      <div className="header">
        <h1>Master Data Configuration</h1>
        <p>Paste the raw data directly from your Excel sheets here using CTRL+V.</p>
      </div>

      <div className="tabs">
        {SHEET_NAMES.map(name => (
          <button 
            key={name}
            className={`tab-btn ${activeTab === name ? 'active' : ''}`}
            onClick={() => setActiveTab(name)}
          >
            {name} ({masterData[name]?.length || 0})
          </button>
        ))}
      </div>

      <div className="card">
        <h2 style={{marginTop: 0}}>Data for {activeTab}</h2>
        <p className="text-muted" style={{marginBottom: '1rem'}}>
          Currently has <strong>{activeDataLength}</strong> rows of data. 
          Pasting new data here and saving will REPLACE the existing data for this sheet.
          <br/>
          <em>You can copy columns directly from Excel and paste here.</em>
        </p>

        <textarea 
          className="tsv-textarea"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste columns from Excel here..."
          rows="15"
        />

        <button className="btn btn-primary" style={{marginTop: '1rem'}} onClick={handleSave}>
          Save Data to {activeTab}
        </button>

        {activeDataLength > 0 && (
          <div className="preview-box">
             <h4>Preview (First 20 rows)</h4>
             <div className="table-container" style={{maxHeight: '400px'}}>
               <table className="preview-table">
                 <thead>
                    <tr>
                       {masterData[activeTab][0]?.map((_, idx) => (
                         <th key={idx} style={{background: 'var(--accent)', color: '#000', textAlign: 'center', minWidth: '80px'}}>
                            {idx + 1}
                         </th>
                       ))}
                    </tr>
                 </thead>
                 <tbody>
                    {masterData[activeTab].slice(0, 20).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, cIndex) => <td key={cIndex} style={{fontSize: '0.8rem'}}>{cell}</td>)}
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataEntryPage;
