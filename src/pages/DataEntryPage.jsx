import React, { useState, useRef } from 'react';
import useStore from '../store';
import { parseTSV } from '../utils';
import * as XLSX from 'xlsx';

const SHEET_NAMES = ['H.COMP', 'MAST', 'WBT', 'WBT2', 'INS', 'EXT', 'RATE', 'DATE', 'WBT UPT'];

function DataEntryPage() {
  const [activeTab, setActiveTab] = useState(SHEET_NAMES[0]);
  const [inputText, setInputText] = useState('');
  const { masterData, setMasterData } = useStore();
  const fileInputRef = useRef(null);

  const handleSave = () => {
    const parsedData = parseTSV(inputText);
    setMasterData(activeTab, parsedData);
    setInputText('');
    alert(`Data saved for ${activeTab}. Rows added: ${parsedData.length}`);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to 2D array
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (json.length > 0) {
          setMasterData(activeTab, json);
          alert(`Success! Uploaded ${json.length} rows to ${activeTab} from file "${file.name}"`);
        } else {
          alert("The file appears to be empty.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse Excel file. Please make sure it's a valid .xlsx or .xlsm file.");
      }
      // Reset input so the same file can be uploaded again if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRunMacro = () => {
    const wbtUpt = masterData['WBT UPT'] || [];
    const currentWbt = masterData['WBT'] || [];
    const currentDate = masterData['DATE'] || [];

    if (wbtUpt.length < 2) {
      alert("WBT UPT must have at least 2 rows (header + data) to run the update.");
      return;
    }

    // 1. Copy data from WBT UPT (A2:AF) to WBT
    // We take all rows from index 1 onwards
    const rowsToCopy = wbtUpt.slice(1).map(row => row.slice(0, 32)); // A to AF
    const updatedWbt = [...currentWbt, ...rowsToCopy];

    // 2. Copy value from F9 in WBT UPT to DATE (last row, column A)
    // F9 is row 9 (index 8), column F (index 5)
    let f9Value = "";
    if (wbtUpt[8] && wbtUpt[8][5]) {
       f9Value = wbtUpt[8][5];
    } else {
       alert("Warning: Could not find value in F9 of WBT UPT. Continuing with empty value.");
    }
    
    const updatedDate = [...currentDate, [f9Value]];

    // Save back to store
    // We update multiple keys. setMasterData only handles one at a time, but we can call it twice
    // or we could add a bulk setter to store. For now, calling twice is fine.
    setMasterData('WBT', updatedWbt);
    setMasterData('DATE', updatedDate);

    alert(`Successfully processed WBT UPT:\n- Added ${rowsToCopy.length} rows to WBT\n- Added date value "${f9Value}" to DATE`);
  };

  const activeDataLength = masterData[activeTab]?.length || 0;
  const showMacroButton = activeTab === 'WBT UPT' && activeDataLength > 0;

  return (
    <div className="page-container">
      <div className="header">
        <h1>Master Data Configuration</h1>
        <p>Paste the raw data directly from your Excel sheets here using CTRL+V.</p>
      </div>

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
           <h2 style={{margin: 0}}>Data for {activeTab}</h2>
           <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".xlsx, .xlsm, .xls, .csv" 
                onChange={handleFileUpload}
              />
              <button className="btn" onClick={() => fileInputRef.current?.click()} style={{ background: '#6366f1' }}>
                 Upload Excel/File to {activeTab}
              </button>
              {showMacroButton && (
                <button className="btn btn-success" onClick={handleRunMacro}>
                   Run Copy Macro (UPT to WBT and DATE)
                </button>
              )}
           </div>
        </div>
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
