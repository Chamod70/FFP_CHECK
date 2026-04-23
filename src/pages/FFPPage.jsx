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
const CALCULATED_COLS = [
  0, 1, 2, 3, 7, 12, 13, 14, 15, 16, 22, 23, 24, 25, 26, 27, 33, 37, 38, 46
];

function FFPPage() {
  const { masterData, ffpManualData, setFfpData } = useStore();
  const [focusedCell, setFocusedCell] = useState(null);

  const formatCell = (rIndex, cIndex, val) => {
     if (val === undefined || val === null) return "";
     let strValue = String(val).trim();
     const isFocused = focusedCell?.r === rIndex && focusedCell?.c === cIndex;

     // While focused, let the user type anything (including dots at the end)
     if (isFocused) {
        return strValue.replace(/,/g, '');
     }
     
     // Only clean the display when NOT focused
     strValue = strValue.replace(/\.+$/, "").trim();

     if (/^[0.\s\-]*$/.test(strValue) && strValue !== "") {
        return "";
     }

     if (strValue === "No" || strValue === "RATE") return "";
     if (strValue === "MA") return "MA";

     if (cIndex < 15 || cIndex > 38) return strValue; 
     
     let cleanVal = strValue.replace(/,/g, '');
     let parsed = parseFloat(cleanVal);
     if (isNaN(parsed) || parsed === 0) return ""; 

     if (cIndex === 15) {
        return parsed.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
     }

     return parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [columnWidths, setColumnWidths] = useState(Array(47).fill(120));

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
     const formattedData = liveData.map(row => 
        row.map((cell, cIdx) => {
           if (cIdx >= 15 && cIdx <= 38) {
              let strVal = String(cell !== undefined && cell !== null ? cell : "");
              let parsed = parseFloat(strVal.replace(/,/g, ''));
              if (!isNaN(parsed)) {
                 const decimals = cIdx === 15 ? 4 : 2;
                 return parsed.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
              }
           }
           return cell;
        })
     );
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

  return (
    <div className="page-container" style={{maxWidth: '100%', padding: '1rem'}}>
      <div className="header">
         <h1 style={{marginTop: 0}}>FFP Live Dashboard</h1>
         <p>Type directly into the non-calculated cells (like L for Farmer ID), and it calculates everything instantly.</p>
      </div>
      
      <div className="actions-bar" style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
         <button className="btn btn-primary" onClick={addRow}><Plus size={16}/> Add Row</button>
         <button className="btn" onClick={handlePasteFFP}>Paste Rows Here</button>
         <button className="btn btn-success" onClick={handleCopyAll}><Copy size={16}/> Copy All Output Data</button>
         <button className="btn btn-danger" onClick={() => setFfpData([])} style={{background: '#ef4444'}}>Clear All</button>
      </div>

      <div className="table-container" style={{maxHeight: '82vh', overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px'}}>
         <table style={{ 
            tableLayout: 'fixed', 
            width: `${columnWidths.reduce((a, b) => a + b, 0) + 60}px`,
            borderCollapse: 'collapse'
         }}>
            <thead>
               <tr>
                  <th style={{position: 'sticky', left: 0, zIndex: 20, width: '60px'}}>Action</th>
                  {COL_NAMES.map((col, i) => {
                    let displayName = col;
                    if (i === 11) displayName = "Plot No (L)";
                    return (
                      <th 
                        key={i} 
                        style={{
                          ...(CALCULATED_COLS.includes(i) ? {color: '#38bdf8'} : {}),
                          width: `${columnWidths[i]}px`,
                          position: 'relative'
                        }}
                      >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                          {displayName}
                        </div>
                        <div 
                          onMouseDown={(e) => startResizing(i, e)}
                          className="col-resizer"
                        />
                      </th>
                    );
                  })}
               </tr>
            </thead>
            <tbody>
               {liveData.map((row, rIndex) => (
                  <tr key={rIndex}>
                    <td style={{position: 'sticky', left: 0, background: 'var(--card-bg)', zIndex: 10, textAlign: 'center'}}>
                      <button onClick={() => removeRow(rIndex)} style={{background: 'transparent', border:'none', color: '#ef4444', cursor: 'pointer'}}>
                         <Trash2 size={16} />
                      </button>
                    </td>
                    {row.map((cell, cIndex) => {
                       const isCalculated = CALCULATED_COLS.includes(cIndex);
                       let cellVal = cell;
                       if (typeof cellVal === 'number' && !Number.isInteger(cellVal)) {
                          cellVal = cellVal.toFixed(2);
                       }
                       if (cellVal === undefined || cellVal === null) cellVal = "";

                       return (
                          <td key={cIndex} style={{
                            ...(isCalculated ? {background: 'rgba(0,0,0,0.2)'} : {}),
                            width: `${columnWidths[cIndex]}px`
                          }}>
                             <input 
                                id={`cell-${rIndex}-${cIndex}`}
                                type="text" 
                                value={formatCell(rIndex, cIndex, cellVal)} 
                                placeholder=""
                                autoFocus={false}
                                autoComplete="off"
                                onChange={(e) => handleCellChange(rIndex, cIndex, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rIndex, cIndex)}
                                onFocus={() => setFocusedCell({r: rIndex, c: cIndex})}
                                onBlur={() => setFocusedCell(null)}
                                className="cell-input"
                                readOnly={isCalculated}
                                style={{
                                   textAlign: cIndex >= 15 && cIndex <= 38 ? 'right' : 'left',
                                   outline: 'none',
                                   boxShadow: 'none',
                                   color: isCalculated ? 'var(--accent)' : '#fff',
                                   cursor: isCalculated ? 'default' : 'text'
                                }}
                             />
                          </td>
                       );
                    })}
                  </tr>
                ))}
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
