import React, { useState } from 'react';
import useStore from '../store';
import { evaluateRow } from '../ffp-logic';
import { Copy, Plus, Trash2 } from 'lucide-react';
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

// Ensure we have exactly 47 columns by padding or formatting
const COL_NAMES = Array.from({ length: 47 }, (_, i) => {
  if (i < rawHeaders.length) return rawHeaders[i].trim();
  // Fallback to standard excel notation A-AU for remaining cols just in case
  const excelCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU"];
  return excelCols[i];
});


// Which columns are strictly calculated? We make them read-only
const CALCULATED_COLS = [];

function FFPPage() {
  const { masterData, ffpManualData, setFfpData, columnWidths, setColumnWidths, customHeaders, setCustomHeader, columnAlignments, setColumnAlignment, columnVerticalAlignments, setColumnVerticalAlignment } = useStore();
  const [focusedCell, setFocusedCell] = useState(null);
  const [selectedCol, setSelectedCol] = useState(null);

  const formatCell = (rIndex, cIndex, val) => {
     if (val === undefined || val === null) return "";
     let strValue = String(val);
     const isFocused = focusedCell?.r === rIndex && focusedCell?.c === cIndex;

      // While focused, let the user type anything.
      if (isFocused) {
         return strValue.replace(/,/g, '');
      }
     
     // Only clean the display when NOT focused
     strValue = strValue.trim();
     // But don't remove dots if they are the only character (manual typing)
     if (strValue.length > 1) {
        strValue = strValue.replace(/\.+$/, "").trim();
     }

     if (/^[\s\-]*$/.test(strValue) && strValue !== "") {
        return "";
     }

     if (strValue === "No" || strValue === "RATE") return "";
     if (strValue === "MA") return "MA";

     // Format date columns: COM /DATE (0), Harvesting Date (4), Date (7)
     if (cIndex === 0 || cIndex === 4 || cIndex === 7) {
        // If it's a number (Excel serial), convert it
        let p = parseFloat(strValue);
        if (!isNaN(p) && p > 1000) {
           const date = new Date(Math.round((p - 25569) * 86400 * 1000));
           return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        }
        // If it's a string date, parse and format it
        const parts = strValue.split('/');
        if (parts.length === 2 || parts.length === 3) {
           let m = parseInt(parts[0]);
           let d = parseInt(parts[1]);
           let y = parts[2] ? parseInt(parts[2]) : 2026;
           if (!isNaN(m) && !isNaN(d)) {
              if (y < 100) y += 2000;
              return `${m}/${d}/${y}`;
           }
        }
        return strValue;
     }

     // Format columns 15 through 42 (indices 14 through 41)
     // Actually rawHeaders[14] is "NIC", 15 is "Extent(HA)"
     if (cIndex < 15 || cIndex > 41) return strValue; 
     
     let cleanVal = strValue.replace(/,/g, '');
     let parsed = parseFloat(cleanVal);
     
     // If it's a manual "." or similar, don't try to parse and format it
     if (isNaN(parsed)) return strValue;
     if (parsed === 0) {
        if (cIndex === 37) return "0.00"; // Show 0.00 for Balance if it's explicitly 0
        return ""; 
     }

     if (cIndex === 15) {
        return parsed.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
     }

     return parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const startResizing = (index, e) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = columnWidths[index];

    const onMouseMove = (moveEvent) => {
      const newWidth = startWidth + (moveEvent.pageX - startX);
      const updatedWidths = [...columnWidths];
      updatedWidths[index] = Math.max(50, newWidth);
      setColumnWidths(updatedWidths);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const autoFitColumn = (colIndex) => {
    // Use a hidden canvas to measure actual pixel widths — like Excel
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // Match the table's font (11pt Calibri from App.css)
    ctx.font = '11pt Calibri, Segoe UI, Arial, sans-serif';

    // Measure the header text
    const headerText = customHeaders && customHeaders[colIndex] !== undefined
      ? String(customHeaders[colIndex])
      : (colIndex === 11 ? 'Plot No (L)' : String(COL_NAMES[colIndex] || ''));
    let maxWidth = ctx.measureText(headerText).width;

    // Measure the formatted value of every data row
    liveData.forEach((row, rIndex) => {
      const raw = row[colIndex];
      // Use formatCell logic: replicate display value
      let displayed = '';
      if (raw !== undefined && raw !== null) {
        let strValue = String(raw).trim().replace(/\.+$/, '').trim();
        if (/^[0.\s\-]*$/.test(strValue) && strValue !== '') {
          displayed = '';
        } else if (strValue === 'No' || strValue === 'RATE') {
          displayed = '';
        } else if (colIndex >= 15 && colIndex <= 38) {
          let cleanVal = strValue.replace(/,/g, '');
          let parsed = parseFloat(cleanVal);
          if (!isNaN(parsed) && parsed !== 0) {
            const decimals = colIndex === 15 ? 4 : 2;
            displayed = parsed.toLocaleString('en-US', {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals
            });
          }
        } else {
          displayed = strValue;
        }
      }
      if (displayed) {
        const w = ctx.measureText(displayed).width;
        if (w > maxWidth) maxWidth = w;
      }
    });

    // Add padding (left + right = 20px) and a small buffer
    const calculatedWidth = Math.max(50, Math.min(500, Math.ceil(maxWidth) + 24));
    const updatedWidths = [...columnWidths];
    updatedWidths[colIndex] = calculatedWidth;
    setColumnWidths(updatedWidths);
  };


  // Compute live data 
  const liveData = ffpManualData.map(manualRow => {
     let newRow = [...manualRow];
     // Expand array to 47 if it's not
     while(newRow.length < 47) newRow.push("");
     // Calculate
     return evaluateRow(newRow, masterData);
  });

  const handleCellChange = (rowIndex, colIndex, value) => {
    const updatedData = [...ffpManualData];
    // ensure row exists and is long enough
    if(!updatedData[rowIndex]) {
        updatedData[rowIndex] = Array(47).fill("");
    }
    while(updatedData[rowIndex].length < 47) updatedData[rowIndex].push("");
    
    updatedData[rowIndex][colIndex] = value;
    setFfpData(updatedData);
  };

  const handleKeyDown = (e, rIndex, cIndex) => {
    let newR = rIndex;
    let newC = cIndex;
    const target = e.target;
    
    // Determine if cursor is at the edges of the text to allow left/right navigation
    const isAtStart = target.selectionStart === 0;
    const isAtEnd = target.selectionEnd === target.value.length;

    if (e.key === 'ArrowUp') {
       newR -= 1;
       e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
       newR += 1;
       e.preventDefault();
    } else if (e.key === 'ArrowLeft' && isAtStart) {
       newC -= 1;
       e.preventDefault();
    } else if (e.key === 'ArrowRight' && isAtEnd) {
       newC += 1;
       e.preventDefault();
    } else {
       return;
    }

    // Support navigation through all columns (including calculated ones)
    if (newC !== cIndex) {
      // Navigation skip logic removed
    }

    // Move to next cell if within bounds
    if (newR >= 0 && newR < ffpManualData.length && newC >= 0 && newC < 47) {
       const nextCell = document.getElementById(`cell-${newR}-${newC}`);
       if (nextCell) {
         nextCell.focus();
         // Select the text when navigating, like Excel does
         setTimeout(() => nextCell.select(), 0);
       }
    }
  };

  const addRow = () => {
    setFfpData([...ffpManualData, Array(47).fill("")]);
  };

  const removeRow = (index) => {
    const updatedData = [...ffpManualData];
    updatedData.splice(index, 1);
    setFfpData(updatedData);
  };

  const handleCopyAll = () => {
     const formattedData = liveData.map(row => {
        // Slice the row to only include columns from index 4 (Harvesting Date) to 41 (Total Loan)
        const slicedRow = row.slice(4, 42);
        return slicedRow.map((cell, idx) => {
           // The original indices were offset by 4. 
           // Original 15..38 are now 11..34 in the sliced row.
           const originalIdx = idx + 4;
           if (originalIdx >= 15 && originalIdx <= 38) {
              let strVal = String(cell !== undefined && cell !== null ? cell : "");
              let parsed = parseFloat(strVal.replace(/,/g, ''));
              if (!isNaN(parsed)) {
                 const decimals = originalIdx === 15 ? 4 : 2;
                 return parsed.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
              }
           }
           return cell;
        });
     });
     const tsv = arrayToTSV(formattedData);
     navigator.clipboard.writeText(tsv).then(() => {
        alert("Copied directly to clipboard! You can paste in Excel.");
     });
  };

  const handlePasteFFP = async () => {
     try {
       const text = await navigator.clipboard.readText();
       if(!text) return;
       const lines = text.split(/\r?\n/).filter(x=>x);
       const newData = lines.map(line => {
          let row = line.split('\t');
          while(row.length < 47) row.push("");
          return row;
       });
       // Append or Replace? Let's just Append for simplicity, or replace if empty
       if (ffpManualData.length === 0) {
           setFfpData(newData);
       } else {
           setFfpData([...ffpManualData, ...newData]);
       }
     } catch (err) {
       alert("Pasting failed. Make sure you gave clipboard permissions.");
     }
  };

  // Count of non-empty plot numbers
  const plotCount = ffpManualData.filter(row => row[11] && row[11].toString().trim() !== "" && row[11] !== ".").length;

  const isEmpty = liveData.length === 0;

  return (
    <div className="page-container" style={{maxWidth: '100%', padding: '1rem'}}>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
         <div>
            <h1 style={{marginTop: 0}}>FFP Live Dashboard</h1>
            <p>Type directly into the non-calculated cells (like L for Farmer ID), and it calculates everything instantly.</p>
         </div>
         <div className="stats-badge" style={{
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid var(--accent)',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            textAlign: 'center'
         }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.25rem' }}>Total Plots</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>{plotCount}</div>
         </div>
      </div>
      
      <div className="actions-bar" style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
         <button className="btn btn-primary" onClick={addRow}><Plus size={16}/> Add Row</button>
         <button className="btn" onClick={handlePasteFFP}>Paste Rows Here</button>
         <button className="btn btn-success" onClick={handleCopyAll}><Copy size={16}/> Copy All Output Data</button>
         <button className="btn btn-danger" onClick={() => setFfpData([])} style={{background: '#ef4444'}}>Clear All</button>
      </div>

      {selectedCol !== null && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--card-bg)', padding: '0.5rem', borderRadius: '4px', border: `1px solid var(--accent)`, marginBottom: '1rem' }}>
           <span style={{fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 'bold', marginRight: '1rem'}}>
             Align Column {selectedCol + 1} ({COL_NAMES[selectedCol]}):
           </span>
           <button className="btn" style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: columnAlignments && columnAlignments[selectedCol] === 'left' ? 'var(--primary)' : 'var(--card-bg)'}} onClick={() => setColumnAlignment && setColumnAlignment(selectedCol, 'left')}>Left</button>
           <button className="btn" style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: columnAlignments && columnAlignments[selectedCol] === 'center' ? 'var(--primary)' : 'var(--card-bg)'}} onClick={() => setColumnAlignment && setColumnAlignment(selectedCol, 'center')}>Center</button>
           <button className="btn" style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: !columnAlignments || columnAlignments[selectedCol] === 'right' || !columnAlignments[selectedCol] ? 'var(--primary)' : 'var(--card-bg)'}} onClick={() => setColumnAlignment && setColumnAlignment(selectedCol, 'right')}>Right</button>
           <span style={{borderLeft: '1px solid var(--border-color)', height: '20px', margin: '0 0.5rem'}}></span>
           <button className="btn" style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: columnVerticalAlignments && columnVerticalAlignments[selectedCol] === 'top' ? 'var(--primary)' : 'var(--card-bg)'}} onClick={() => setColumnVerticalAlignment && setColumnVerticalAlignment(selectedCol, 'top')}>Top</button>
           <button className="btn" style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: columnVerticalAlignments && columnVerticalAlignments[selectedCol] === 'middle' ? 'var(--primary)' : 'var(--card-bg)'}} onClick={() => setColumnVerticalAlignment && setColumnVerticalAlignment(selectedCol, 'middle')}>Middle</button>
           <button className="btn" style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: !columnVerticalAlignments || columnVerticalAlignments[selectedCol] === 'bottom' || !columnVerticalAlignments[selectedCol] ? 'var(--primary)' : 'var(--card-bg)'}} onClick={() => setColumnVerticalAlignment && setColumnVerticalAlignment(selectedCol, 'bottom')}>Bottom</button>
           <button onClick={() => setSelectedCol(null)} style={{marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.5rem'}}>✕</button>
        </div>
      )}

      <div className="table-container" style={{maxHeight: '82vh', overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px'}}>
         <table style={{ 
            tableLayout: 'fixed', 
            width: `${columnWidths.reduce((a, b) => a + b, 0) + 60}px`,
            borderCollapse: 'collapse'
         }}>
            <thead>
               <tr style={{ height: '25px' }}>
                  <th style={{ 
                    position: 'sticky', 
                    left: 0, 
                    zIndex: 36, 
                    top: 0, 
                    background: 'rgba(0,0,0,0.6)',
                    borderBottom: 'none',
                    width: '60px',
                    minWidth: '60px',
                    padding: 0
                  }}></th>
                  {COL_NAMES.map((_, i) => (
                    <th key={`num-${i}`} 
                        onClick={() => setSelectedCol(prev => prev === i ? null : i)}
                        onDoubleClick={() => autoFitColumn(i)}
                        title={`Column ${i + 1} — Click: align options | Double-click: auto-fit width`}
                        style={{
                      textAlign: columnAlignments && columnAlignments[i] ? columnAlignments[i] : 'right',
                      verticalAlign: columnVerticalAlignments && columnVerticalAlignments[i] ? columnVerticalAlignments[i] : 'bottom',
                      fontSize: '0.8rem',
                      color: selectedCol === i ? '#fff' : 'var(--accent)',
                      background: selectedCol === i ? 'rgba(56, 189, 248, 0.2)' : 'rgba(0, 0, 0, 0.6)',
                      top: 0,
                      position: 'sticky',
                      zIndex: 30,
                      borderBottom: 'none',
                      padding: '4px 6px',
                      fontWeight: 'bold',
                      borderRight: '1px solid var(--border-color)',
                      width: `${columnWidths[i]}px`,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}>
                      {i + 1}
                    </th>
                  ))}
               </tr>
               <tr>
                  <th style={{
                    position: 'sticky', 
                    left: 0, 
                    zIndex: 35, 
                    top: '31px', 
                    background: 'var(--card-bg)', 
                    width: '60px'
                  }}>Action</th>
                  {COL_NAMES.map((col, i) => {
                    let displayName = col;
                    if (i === 11) displayName = "Plot No (L)";
                    return (
                      <th 
                        key={i} 
                        style={{
                          ...(CALCULATED_COLS.includes(i) ? {color: '#38bdf8'} : {}),
                          width: `${columnWidths[i]}px`,
                          position: 'sticky',
                          top: '31px',
                          zIndex: 30,
                          textAlign: columnAlignments && columnAlignments[i] ? columnAlignments[i] : 'right',
                          verticalAlign: columnVerticalAlignments && columnVerticalAlignments[i] ? columnVerticalAlignments[i] : 'bottom',
                          paddingRight: '6px',
                          background: selectedCol === i ? 'rgba(56, 189, 248, 0.1)' : undefined,
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ overflow: 'hidden', width: '100%' }}>
                          <input 
                            type="text" 
                            value={customHeaders && customHeaders[i] !== undefined ? customHeaders[i] : displayName}
                            onChange={(e) => setCustomHeader && setCustomHeader(i, e.target.value)}
                            title={customHeaders && customHeaders[i] !== undefined ? customHeaders[i] : displayName}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'inherit',
                              fontWeight: 'inherit',
                              width: '100%',
                              textAlign: columnAlignments && columnAlignments[i] ? columnAlignments[i] : 'right',
                              outline: 'none',
                              fontSize: 'inherit',
                              fontFamily: 'inherit',
                              textOverflow: 'ellipsis',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                        <div 
                          onMouseDown={(e) => startResizing(i, e)}
                          onDoubleClick={() => autoFitColumn(i)}
                          className="col-resizer"
                        />
                      </th>
                    );
                  })}
               </tr>
            </thead>
            <tbody>
                {liveData.map((row, rIndex) => {
                   const balance = parseFloat(String(row[37] || "0").replace(/,/g, ''));
                   const isOliverGreen = balance === 0 && row[11] && row[11].toString().trim() !== "" && row[11] !== ".";
                   
                   return (
                   <tr key={rIndex} style={isOliverGreen ? { background: '#6B8E23' } : {}}>
                    <td style={{position: 'sticky', left: 0, background: '#1e293b', zIndex: 15, textAlign: 'center', minWidth: '60px', width: '60px', borderRight: '1px solid var(--border-color)'}}>
                      <button onClick={() => removeRow(rIndex)} title="Delete row" style={{background: 'transparent', border:'none', color: '#ef4444', cursor: 'pointer'}}>
                         <Trash2 size={16} />
                      </button>
                    </td>
                    {row.map((cell, cIndex) => {
                       const isCalculated = CALCULATED_COLS.includes(cIndex);
                       let cellVal = cell;
                       if (cellVal === undefined || cellVal === null) cellVal = "";

                       return (
                          <td key={cIndex} style={{
                            ...(isCalculated ? {background: 'rgba(0,0,0,0.2)'} : {}),
                            width: `${columnWidths[cIndex]}px`
                          }}>
                             <input 
                                id={`cell-${rIndex}-${cIndex}`}
                                type="text" 
                                value={(focusedCell?.r === rIndex && focusedCell?.c === cIndex) ? (ffpManualData[rIndex]?.[cIndex] || String(cellVal).replace(/,/g, '')) : formatCell(rIndex, cIndex, cellVal)} 
                                placeholder=""
                                autoFocus={false}
                                autoComplete="off"
                                onChange={(e) => handleCellChange(rIndex, cIndex, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rIndex, cIndex)}
                                onFocus={() => setFocusedCell({r: rIndex, c: cIndex})}
                                onBlur={() => setFocusedCell(null)}
                                className="cell-input"
                                style={{
                                   textAlign: columnAlignments && columnAlignments[cIndex] ? columnAlignments[cIndex] : 'right',
                                   verticalAlign: columnVerticalAlignments && columnVerticalAlignments[cIndex] ? columnVerticalAlignments[cIndex] : 'bottom',
                                   outline: 'none',
                                   boxShadow: 'none',
                                   color: isCalculated ? 'var(--accent)' : '#fff',
                                   cursor: 'text'
                                }}
                             />
                          </td>
                       );
                    })}
                  </tr>
                )})}
               {liveData.length === 0 && (
                 <tr>
                   <td colSpan={100} style={{textAlign: 'center', padding: '3rem'}}>
                     No data available. Click "Add Row" or "Paste Rows Here" to begin.
                   </td>
                 </tr>
               )}
            </tbody>
         </table>
      </div>
    </div>
  );
}

export default FFPPage;
