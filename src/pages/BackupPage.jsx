import React, { useState } from 'react';
import useStore from '../store';
import { Trash2, Copy, Download } from 'lucide-react';
import { arrayToTSV } from '../utils';

const rawHeaders = [
  "COM /DATE", "PART", "ACC", "D", "Harvesting Date", "Sheet No", "Crop Cycle", "Date", 
  "Voucher No", "Cheque No", "Confirm Status", "Plot No", "Farmer", "AGENT", "NIC", 
  "Extent(HA)", "INT RATE %", "Seed", "S", "T", "U", "24-25", "25-26", "Total", 
  "Cane value", "Development Incentive", "Temporary Incentive", "Rec Cane Advance", 
  "MTL Rec", "STL Recovery", "Cash Advance", "Festivel Advance", "Load Up", 
  "Machine Charges", "Labour Charges", "Cane Knife Lost", "Interest", "Balance", 
  "AM", "Minus Amount", "Remaining Interest Amount", "Total Loan(Minus Payment only)",
  "AQ", "AR", "AS", "AT", "AU"
];

const COL_NAMES = Array.from({ length: 47 }, (_, i) => {
  if (i < rawHeaders.length) return rawHeaders[i].trim();
  const excelCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU"];
  return excelCols[i];
});

function BackupPage() {
  const { backupData, setBackupData, columnWidths } = useStore();
  const [searchTerm, setSearchTerm] = useState("");

  const formatCell = (cIndex, val) => {
     if (val === undefined || val === null) return "";
     let strValue = String(val).trim();
     
     if (strValue.length > 1) {
        strValue = strValue.replace(/\.+$/, "").trim();
     }

     if (cIndex === 0 || cIndex === 4 || cIndex === 7) {
        let p = parseFloat(strValue);
        if (!isNaN(p) && p > 1000) {
           const date = new Date(Math.round((p - 25569) * 86400 * 1000));
           return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        }
        return strValue;
     }

     if (cIndex < 15 || cIndex > 41) return strValue; 
     
     let cleanVal = strValue.replace(/,/g, '');
     let parsed = parseFloat(cleanVal);
     
     if (isNaN(parsed)) return strValue;
     if (Math.abs(parsed) < 0.0001) parsed = 0;

     if (parsed === 0) return "";

     const decimals = (cIndex === 15) ? 4 : 2;
     return parsed.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const handleCopyAll = () => {
     const tsv = arrayToTSV(backupData);
     navigator.clipboard.writeText(tsv).then(() => {
        alert("Backup data copied to clipboard!");
     });
  };

  const handleClearBackup = () => {
    if (window.confirm("Are you sure you want to clear ALL backup data? This cannot be undone.")) {
      setBackupData([]);
    }
  };

  const filteredData = backupData.filter(row => 
    row.some(cell => String(cell).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="page-container" style={{maxWidth: '100%', padding: '1rem'}}>
      <div className="header">
        <h1>Backup Data</h1>
        <p>This page stores data cleared from the FFP Live Check page.</p>
      </div>

      <div className="actions-bar" style={{display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center'}}>
         <input 
           type="text" 
           placeholder="Search in backup..." 
           value={searchTerm}
           onChange={(e) => setSearchTerm(e.target.value)}
           className="cell-input"
           style={{ padding: '0.5rem', width: '300px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'white' }}
         />
         <button className="btn btn-success" onClick={handleCopyAll}><Copy size={16}/> Copy All Backup</button>
         <button className="btn btn-danger" onClick={handleClearBackup} style={{background: '#ef4444'}}><Trash2 size={16}/> Clear Backup</button>
         <div style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
           Total Records: {backupData.length}
         </div>
      </div>

      <div className="table-container" style={{maxHeight: '75vh', overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px'}}>
         <table style={{ 
            tableLayout: 'fixed', 
            width: `${columnWidths.reduce((a, b) => a + b, 0) + 60}px`,
            borderCollapse: 'collapse'
         }}>
            <thead>
               <tr style={{ height: '30px' }}>
                  <th style={{ position: 'sticky', left: 0, zIndex: 45, top: 0, background: '#0b1120', borderBottom: '1px solid var(--border-color)', width: '60px' }}>#</th>
                  {COL_NAMES.map((_, i) => (
                    <th key={i} style={{
                      fontSize: '0.8rem',
                      color: 'var(--accent)',
                      background: '#0b1120',
                      top: 0,
                      position: 'sticky',
                      zIndex: 40,
                      borderBottom: '1px solid var(--border-color)',
                      padding: '4px 6px',
                      borderRight: '1px solid var(--border-color)',
                      width: `${columnWidths[i]}px`
                    }}>{i + 1}</th>
                  ))}
               </tr>
               <tr style={{ height: '45px' }}>
                  <th style={{ position: 'sticky', left: 0, zIndex: 42, top: '30px', background: '#1e293b', borderBottom: '2px solid var(--accent)' }}>Row</th>
                  {COL_NAMES.map((col, i) => (
                    <th key={i} style={{
                      width: `${columnWidths[i]}px`,
                      position: 'sticky',
                      top: '30px',
                      zIndex: 40,
                      background: '#1e293b',
                      borderBottom: '2px solid var(--accent)',
                      padding: '0 6px',
                      fontSize: '0.9rem'
                    }}>{col}</th>
                  ))}
               </tr>
            </thead>
            <tbody>
                {filteredData.map((row, rIndex) => (
                   <tr key={rIndex}>
                    <td style={{position: 'sticky', left: 0, background: '#1e293b', zIndex: 15, textAlign: 'center', borderRight: '1px solid var(--border-color)'}}>
                      {rIndex + 1}
                    </td>
                    {row.map((cell, cIndex) => (
                       <td key={cIndex} style={{ padding: '4px 8px', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontSize: '0.9rem' }}>
                          {formatCell(cIndex, cell)}
                       </td>
                    ))}
                   </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={100} style={{textAlign: 'center', padding: '3rem'}}>
                      {searchTerm ? "No matching records found." : "No backup data available."}
                    </td>
                  </tr>
                )}
            </tbody>
         </table>
      </div>
    </div>
  );
}

export default BackupPage;
