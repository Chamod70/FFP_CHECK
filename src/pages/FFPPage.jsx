import React, { useState } from 'react';
import useStore from '../store';
import { evaluateRow } from '../ffp-logic';
import { Copy, Plus, Trash2, Eye, EyeOff, Undo2, Redo2, ChevronDown, ChevronUp } from 'lucide-react';
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
  const { masterData, ffpManualData, setFfpData, addToBackupData, columnWidths, setColumnWidths, customHeaders, setCustomHeader, columnAlignments, setColumnAlignment, columnVerticalAlignments, setColumnVerticalAlignment, hiddenColumns, setHiddenColumns, hiddenColumnGroup, setHiddenColumnGroup } = useStore();
  const [focusedCell, setFocusedCell] = useState(null);
  const [selectedCol, setSelectedCol] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [hasAlerted, setHasAlerted] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHideGroupBar, setShowHideGroupBar] = useState(() => {
    const saved = localStorage.getItem('ffp_show_hide_group_bar');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleHideGroupBar = () => {
    setShowHideGroupBar(prev => {
      const next = !prev;
      localStorage.setItem('ffp_show_hide_group_bar', JSON.stringify(next));
      return next;
    });
  };

  React.useEffect(() => {
    if (history.length === 0 && ffpManualData) {
      setHistory([ffpManualData]);
      setHistoryIndex(0);
    }
  }, [ffpManualData, history]);

  const updateFfpData = (newData) => {
    setFfpData(newData);
    let newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newData);
    if (newHistory.length > 50) {
      newHistory = newHistory.slice(newHistory.length - 50);
    }
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setFfpData(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setFfpData(history[newIndex]);
    }
  };

  const hideColumn = (index) => {
    setHiddenColumns({
      ...(hiddenColumns || {}),
      [index]: true
    });
    setSelectedCol(null);
  };

  const unhideColumn = (index) => {
    const next = { ...(hiddenColumns || {}) };
    delete next[index];
    setHiddenColumns(next);
  };

  const toggleGroup = (index) => {
    const nextGroup = { ...(hiddenColumnGroup || {}) };
    if (nextGroup[index]) {
      delete nextGroup[index];
    } else {
      nextGroup[index] = true;
    }
    setHiddenColumnGroup(nextGroup);
  };

  const removeFromGroup = (index) => {
    const nextGroup = { ...(hiddenColumnGroup || {}) };
    delete nextGroup[index];
    setHiddenColumnGroup(nextGroup);
  };

  const hideAllInGroup = () => {
    const nextHidden = { ...(hiddenColumns || {}) };
    Object.keys(hiddenColumnGroup || {}).forEach(idx => {
      nextHidden[idx] = true;
    });
    setHiddenColumns(nextHidden);
    setSelectedCol(null);
  };

  const unhideAllInGroup = () => {
    const nextHidden = { ...(hiddenColumns || {}) };
    Object.keys(hiddenColumnGroup || {}).forEach(idx => {
      delete nextHidden[idx];
    });
    setHiddenColumns(nextHidden);
  };

  const clearGroup = () => {
    setHiddenColumnGroup({});
  };

  const addPresetDataColumnsToGroup = () => {
    const newGroup = {};
    for (let i = 4; i <= 37; i++) {
      newGroup[i] = true;
    }
    setHiddenColumnGroup(newGroup);
  };

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

     // Fix negative zero issue by rounding very small values
     if (Math.abs(parsed) < 0.0001) parsed = 0;

     if (parsed === 0) {
        if (strValue.trim() !== "" && strValue !== ".") {
           const decimals = (cIndex === 15) ? 4 : 2;
           return (0).toFixed(decimals);
        }
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
    // Get latest state directly to prevent stale closures during fast typing
    const currentData = useStore.getState().ffpManualData;
    const updatedData = [...currentData];
    // ensure row exists and is long enough
    if(!updatedData[rowIndex]) {
        updatedData[rowIndex] = Array(47).fill("");
    } else {
        updatedData[rowIndex] = [...updatedData[rowIndex]];
    }
    while(updatedData[rowIndex].length < 47) updatedData[rowIndex].push("");
    
    updatedData[rowIndex][colIndex] = value;
    // Update store directly for speed; history is saved on blur
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
       while (newC >= 0 && (hiddenColumns || {})[newC]) {
           newC -= 1;
       }
       e.preventDefault();
    } else if (e.key === 'ArrowRight' && isAtEnd) {
       newC += 1;
       while (newC < 47 && (hiddenColumns || {})[newC]) {
           newC += 1;
       }
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
         // Fix: Only select if this cell is still the active element to prevent 
         // focus bouncing when keys are pressed rapidly.
         setTimeout(() => {
           if (document.activeElement === nextCell) {
             nextCell.select();
           }
         }, 0);
       }
    }
  };

  const addRow = () => {
    updateFfpData([...ffpManualData, Array(47).fill("")]);
  };

  const addTenRows = () => {
    const newRows = Array.from({ length: 10 }, () => Array(47).fill(""));
    updateFfpData([...ffpManualData, ...newRows]);
  };

  const removeRow = (index) => {
    const updatedData = [...ffpManualData];
    updatedData.splice(index, 1);
    updateFfpData(updatedData);
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
           updateFfpData(newData);
       } else {
           updateFfpData([...ffpManualData, ...newData]);
       }
     } catch (err) {
       alert("Pasting failed. Make sure you gave clipboard permissions.");
     }
  };

  const plotCount = liveData.filter(row => row[11] && row[11].toString().trim() !== "" && row[11] !== ".").length;

  const totalBalance = liveData.reduce((sum, row) => {
     if (!row[11] || row[11].toString().trim() === "" || row[11] === ".") return sum;
     let val = String(row[37] || "0").replace(/,/g, '');
     return sum + (parseFloat(val) || 0);
  }, 0);

  React.useEffect(() => {
    if (totalBalance > 5000000 && !hasAlerted) {
      alert("අවවාදයි: Total Balance එක මිලියන 5 ඉක්මවා ඇත! (Total Balance has exceeded 5 Million)");
      setHasAlerted(true);
    } else if (totalBalance <= 5000000 && hasAlerted) {
      setHasAlerted(false);
    }
  }, [totalBalance, hasAlerted]);

  const isEmpty = liveData.length === 0;

  const handleClearAll = () => {
    if (ffpManualData.length > 0) {
      // Create a static snapshot of the current calculated data
      // We process the data to ensure it's "Value Only" (formula results converted to static values)
      const valueOnlyData = liveData.map((row, rIdx) => {
        return row.map((cell, cIdx) => {
          // Use the same formatting logic used for display to "freeze" the values
          // This converts Excel serial dates to strings and ensures numbers are rounded
          const formatted = formatCell(rIdx, cIdx, cell);
          return formatted === "" ? cell : formatted;
        });
      });

      addToBackupData(valueOnlyData);
      updateFfpData([]);
      setHiddenColumns({});
      alert("Current data has been moved to Backup page as static values.");
    }
  };

  return (
    <div className="page-container" style={{maxWidth: '100%', padding: '1rem', display: 'flex', flexDirection: 'column', height: '100vh', boxSizing: 'border-box'}}>
      <div style={{ flexShrink: 0 }}>
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
           <div>
              <h1 style={{marginTop: 0}}>FFP Live Dashboard</h1>
              <p>Type directly into the non-calculated cells (like L for Farmer ID), and it calculates everything instantly.</p>
           </div>
           <div style={{ display: 'flex', gap: '1rem' }}>
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
             <div className="stats-badge" style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid var(--success)',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                textAlign: 'center'
             }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.25rem' }}>Total Balance</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>
                   {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
             </div>
           </div>
         <div className="zoom-controls" style={{
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid var(--border-color)',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginLeft: '1rem'
         }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>ZOOM</span>
            <button className="btn" style={{ padding: '0.25rem 0.5rem', minWidth: '30px' }} onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}>-</button>
            <span style={{ minWidth: '45px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>{zoomLevel}%</span>
            <button className="btn" style={{ padding: '0.25rem 0.5rem', minWidth: '30px' }} onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}>+</button>
            <button className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }} onClick={() => setZoomLevel(100)}>Reset</button>
         </div>
      </div>
      
      <div className="actions-bar" style={{display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap'}}>
         <button className="btn btn-primary" onClick={addRow}><Plus size={16}/> Add Row</button>
         <button className="btn btn-primary" onClick={addTenRows} style={{background: 'var(--accent)', color: '#000'}}><Plus size={16}/> Add 10 Rows</button>
         <button className="btn" onClick={handlePasteFFP}>Paste Rows Here</button>
         <button className="btn btn-success" onClick={handleCopyAll}><Copy size={16}/> Copy All Output Data</button>
         
         <button 
           className="btn" 
           onClick={toggleHideGroupBar} 
           style={{
             display: 'flex', 
             alignItems: 'center', 
             gap: '0.4rem',
             background: showHideGroupBar ? 'rgba(16, 185, 129, 0.15)' : 'var(--card-bg)',
             border: `1px solid ${showHideGroupBar ? '#10b981' : 'var(--border-color)'}`,
             color: showHideGroupBar ? '#10b981' : 'var(--text-muted)',
             fontWeight: 500,
             cursor: 'pointer'
           }}
           title={showHideGroupBar ? "Hide Group panel eka hide karanna" : "Hide Group panel eka show karanna"}
         >
           {showHideGroupBar ? <EyeOff size={16} /> : <Eye size={16} />}
           <span>{showHideGroupBar ? 'Hide Group Bar' : 'Show Hide Group'}</span>
           {Object.keys(hiddenColumnGroup || {}).length > 0 && (
             <span style={{
               background: showHideGroupBar ? '#10b981' : '#38bdf8',
               color: showHideGroupBar ? '#fff' : '#0f172a',
               fontSize: '0.72rem',
               fontWeight: 'bold',
               padding: '0.1rem 0.45rem',
               borderRadius: '999px',
               marginLeft: '0.15rem'
             }}>
               {Object.keys(hiddenColumnGroup || {}).length}
             </span>
           )}
           {showHideGroupBar ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
         </button>
         
         <div style={{display: 'flex', gap: '0.5rem', marginLeft: 'auto'}}>
            <button className="btn" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo">
               <Undo2 size={16} /> Undo
            </button>
            <button className="btn" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Redo">
               <Redo2 size={16} /> Redo
            </button>
         </div>

         <button className="btn btn-danger" onClick={handleClearAll} style={{background: '#ef4444'}}>Clear All</button>
      </div>

      {Object.keys(hiddenColumns || {}).length > 0 && (
         <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Hidden Columns:</span>
            {Object.keys(hiddenColumns || {}).map(colIndexStr => {
               const i = parseInt(colIndexStr);
               return (
                 <div key={i} style={{background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem'}}>
                    {COL_NAMES[i]} 
                    <button onClick={() => unhideColumn(i)} style={{background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center'}} title="Unhide column"><Eye size={14}/></button>
                 </div>
               )
            })}
         </div>
      )}

      {/* Hide Group Management Bar */}
      {showHideGroupBar && (
        <div style={{ 
           display: 'flex', 
           gap: '0.75rem', 
           alignItems: 'center', 
           marginBottom: '1rem', 
           flexWrap: 'wrap',
           background: 'rgba(16, 185, 129, 0.08)',
           border: '1px solid rgba(16, 185, 129, 0.3)',
           padding: '0.5rem 0.75rem',
           borderRadius: '6px'
        }}>
           <span style={{fontSize: '0.85rem', color: '#10b981', fontWeight: 'bold'}}>
              Hide Group ({Object.keys(hiddenColumnGroup || {}).length} columns):
           </span>

           {Object.keys(hiddenColumnGroup || {}).length > 0 ? (
              <>
                 <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {Object.keys(hiddenColumnGroup || {}).map(colIndexStr => {
                       const i = parseInt(colIndexStr);
                       const isHidden = !!(hiddenColumns || {})[i];
                       return (
                         <div key={`hg-${i}`} style={{
                            background: isHidden ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.2)', 
                            border: `1px solid ${isHidden ? '#ef4444' : '#10b981'}`, 
                            borderRadius: '4px', 
                            padding: '0.15rem 0.45rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.35rem', 
                            fontSize: '0.75rem',
                            color: isHidden ? '#fca5a5' : '#a7f3d0'
                         }}>
                            <span>{COL_NAMES[i]} {isHidden ? '(Hidden)' : ''}</span> 
                            <button onClick={() => removeFromGroup(i)} style={{background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center'}} title="Remove from group">✕</button>
                         </div>
                       );
                    })}
                 </div>

                 {Object.keys(hiddenColumnGroup || {}).some(idx => !(hiddenColumns || {})[idx]) ? (
                    <button className="btn" onClick={hideAllInGroup} style={{padding: '0.3rem 0.85rem', fontSize: '0.85rem', background: '#10b981', color: '#fff', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer'}}>
                       <EyeOff size={15} /> Hide Group Columns
                    </button>
                 ) : (
                    <button className="btn" onClick={unhideAllInGroup} style={{padding: '0.3rem 0.85rem', fontSize: '0.85rem', background: '#0284c7', color: '#fff', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer'}}>
                       <Eye size={15} /> Unhide Group Columns
                    </button>
                 )}

                 <button className="btn" onClick={clearGroup} style={{padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'transparent', color: '#94a3b8', border: '1px solid #475569', cursor: 'pointer'}}>
                    Clear Group
                 </button>
              </>
           ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                 <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    No columns added to group yet. Click any column number (1, 2, 3...) to add, or load preset:
                 </span>
                 <button 
                    className="btn" 
                    onClick={addPresetDataColumnsToGroup} 
                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', background: '#059669', color: '#fff', border: 'none', fontWeight: 500, cursor: 'pointer' }}
                 >
                    + Add Data Columns (Col 5 - 38) to Group
                 </button>
              </div>
           )}

           <button 
             onClick={toggleHideGroupBar} 
             style={{
               padding: '0.25rem 0.5rem', 
               fontSize: '0.75rem', 
               background: 'transparent', 
               color: '#94a3b8', 
               border: '1px solid #475569', 
               cursor: 'pointer',
               display: 'flex',
               alignItems: 'center',
               gap: '0.25rem',
               marginLeft: 'auto'
             }}
             title="Close Hide Group panel"
           >
             <EyeOff size={13} /> Close
           </button>
        </div>
      )}

       {selectedCol !== null && (
         <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--card-bg)', padding: '0.5rem', borderRadius: '4px', border: `1px solid var(--accent)`, marginBottom: '1rem', flexWrap: 'wrap' }}>
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
            <span style={{borderLeft: '1px solid var(--border-color)', height: '20px', margin: '0 0.5rem'}}></span>
            <button className="btn" style={{padding: '0.25rem 0.6rem', fontSize: '0.8rem', background: (hiddenColumnGroup || {})[selectedCol] ? '#10b981' : 'var(--card-bg)', color: (hiddenColumnGroup || {})[selectedCol] ? '#fff' : '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.25rem', border: (hiddenColumnGroup || {})[selectedCol] ? '1px solid #10b981' : '1px solid var(--border-color)', fontWeight: (hiddenColumnGroup || {})[selectedCol] ? 'bold' : 'normal', cursor: 'pointer'}} onClick={() => toggleGroup(selectedCol)}>
               {(hiddenColumnGroup || {})[selectedCol] ? '✓ In Hide Group (Click to remove)' : '+ Add to Hide Group'}
            </button>
            <button className="btn" style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'var(--card-bg)', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '0.25rem', border: '1px solid var(--border-color)', cursor: 'pointer'}} onClick={() => hideColumn(selectedCol)}>
               <EyeOff size={14} /> Hide Column
            </button>
            <button onClick={() => setSelectedCol(null)} style={{marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.5rem'}}>✕</button>
         </div>
       )}
      </div>

      <div className="table-container" style={{flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px'}}>
         <table style={{ 
            tableLayout: 'fixed', 
            width: `${columnWidths.reduce((a, b, i) => a + ((hiddenColumns || {})[i] ? 0 : b), 0) + 60}px`,
            borderCollapse: 'collapse',
            zoom: zoomLevel / 100
         }}>
            <thead>
               <tr style={{ height: '30px' }}>
                  <th style={{ 
                    position: 'sticky', 
                    left: 0, 
                    zIndex: 45, 
                    top: 0, 
                    background: '#0b1120',
                    borderBottom: '1px solid var(--border-color)',
                    width: '60px',
                    minWidth: '60px',
                    padding: 0
                  }}></th>
                  {COL_NAMES.map((_, i) => !(hiddenColumns || {})[i] && (
                    <th key={`num-${i}`} 
                        onClick={() => setSelectedCol(prev => prev === i ? null : i)}
                        onDoubleClick={() => autoFitColumn(i)}
                        title={`Column ${i + 1} — Click: align options | Double-click: auto-fit width`}
                        style={{
                      textAlign: columnAlignments && columnAlignments[i] ? columnAlignments[i] : 'right',
                      verticalAlign: columnVerticalAlignments && columnVerticalAlignments[i] ? columnVerticalAlignments[i] : 'bottom',
                      fontSize: '0.8rem',
                      color: selectedCol === i ? '#fff' : (i >= 4 && i <= 37 ? '#6ee7b7' : 'var(--accent)'),
                      background: selectedCol === i ? 'rgba(56, 189, 248, 0.2)' : (i >= 4 && i <= 37 ? '#022c22' : '#0b1120'),
                      top: 0,
                      position: 'sticky',
                      zIndex: 40,
                      borderBottom: '1px solid var(--border-color)',
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
               <tr style={{ height: '45px' }}>
                  <th style={{
                    position: 'sticky', 
                    left: 0, 
                    zIndex: 42, 
                    top: '30px', 
                    background: '#1e293b', 
                    width: '60px',
                    borderBottom: '2px solid var(--accent)'
                  }}>Action</th>
                  {COL_NAMES.map((col, i) => {
                    if ((hiddenColumns || {})[i]) return null;
                    let displayName = col;
                    if (i === 11) displayName = "Plot No (L)";
                    return (
                      <th 
                        key={i} 
                        style={{
                          ...(CALCULATED_COLS.includes(i) ? {color: '#38bdf8'} : (i >= 4 && i <= 37 ? {color: '#a7f3d0'} : {})),
                          width: `${columnWidths[i]}px`,
                          position: 'sticky',
                          top: '30px',
                          zIndex: 40,
                          textAlign: columnAlignments && columnAlignments[i] ? columnAlignments[i] : 'right',
                          verticalAlign: columnVerticalAlignments && columnVerticalAlignments[i] ? columnVerticalAlignments[i] : 'bottom',
                          paddingRight: '6px',
                          background: selectedCol === i ? 'rgba(56, 189, 248, 0.1)' : (i >= 4 && i <= 37 ? '#064e3b' : '#1e293b'),
                          cursor: 'pointer',
                          borderBottom: '2px solid var(--accent)'
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
                   const isOliverGreen = Math.abs(balance) < 0.01 && row[11] && row[11].toString().trim() !== "" && row[11] !== ".";
                   
                   return (
                   <tr key={rIndex} style={isOliverGreen ? { background: '#6B8E23' } : {}}>
                    <td style={{position: 'sticky', left: 0, background: '#1e293b', zIndex: 15, textAlign: 'center', minWidth: '60px', width: '60px', borderRight: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '100%', padding: '4px 0'}}>
                      <button onClick={() => removeRow(rIndex)} title="Delete row" style={{background: 'transparent', border:'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', width: '100%'}}>
                         <Trash2 size={16} />
                      </button>
                    </td>
                    {row.map((cell, cIndex) => {
                       if ((hiddenColumns || {})[cIndex]) return null;
                       const isCalculated = CALCULATED_COLS.includes(cIndex);
                       let cellVal = cell;
                       if (cellVal === undefined || cellVal === null) cellVal = "";
                       
                       let customBackground = undefined;
                       let customColor = undefined;
                       
                       if (cIndex === 37) { // 38th column (0-indexed 37) -> Balance
                           const sheetNo = row[5]; // 6th column (0-indexed 5) -> Sheet No
                           if (sheetNo && sheetNo.toString().trim() !== "" && sheetNo !== ".") {
                               const ffpSummaryData = masterData['FFP Summary'] || [];
                               // Find row in FFP Summary where 4th column (index 3) matches Sheet No
                               const summaryRow = ffpSummaryData.find(sRow => {
                                   return sRow[3] !== undefined && sRow[3] !== null && sRow[3].toString().trim() === sheetNo.toString().trim();
                               });
                               
                               if (summaryRow) {
                                   const bankedAmount = parseFloat(String(summaryRow[14] || "0").replace(/,/g, '')); // 15th column (index 14) -> Banked Amount
                                   const balanceAmount = parseFloat(String(cellVal || "0").replace(/,/g, ''));
                                   
                                   if (!isNaN(bankedAmount) && !isNaN(balanceAmount)) {
                                       if (Math.abs(bankedAmount - balanceAmount) < 0.01) {
                                           customBackground = '#bae6fd'; // light blue
                                           customColor = '#000'; // black text for contrast
                                       } else {
                                           customBackground = '#fca5a5'; // light red
                                           customColor = '#000'; // black text for contrast
                                       }
                                   }
                               }
                           }
                       }

                       return (
                          <td key={cIndex} style={{
                            ...(customBackground ? {background: customBackground} : (isCalculated ? {background: 'rgba(0,0,0,0.2)'} : {})),
                            width: `${columnWidths[cIndex]}px`,
                            position: 'relative'
                          }}>
                             <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
                                <input 
                                   id={`cell-${rIndex}-${cIndex}`}
                                   type="text" 
                                   value={(focusedCell?.r === rIndex && focusedCell?.c === cIndex) ? (ffpManualData[rIndex]?.[cIndex] || (typeof cellVal === 'number' ? (Math.abs(cellVal) < 0.0001 ? (0).toFixed(cIndex === 15 ? 4 : 2) : cellVal.toFixed(cIndex === 15 ? 4 : 2)) : String(cellVal).replace(/,/g, ''))) : formatCell(rIndex, cIndex, cellVal)} 
                                   placeholder=""
                                   autoFocus={false}
                                   autoComplete="off"
                                   onChange={(e) => handleCellChange(rIndex, cIndex, e.target.value)}
                                   onKeyDown={(e) => handleKeyDown(e, rIndex, cIndex)}
                                   onFocus={() => setFocusedCell({r: rIndex, c: cIndex})}
                                   onBlur={() => {
                                      setFocusedCell(null);
                                      const currentData = useStore.getState().ffpManualData;
                                      if (history.length === 0 || history[historyIndex] !== currentData) {
                                         let newHistory = history.slice(0, historyIndex + 1);
                                         newHistory.push(currentData);
                                         if (newHistory.length > 50) {
                                            newHistory = newHistory.slice(newHistory.length - 50);
                                         }
                                         setHistory(newHistory);
                                         setHistoryIndex(newHistory.length - 1);
                                      }
                                   }}
                                   className="cell-input"
                                   style={{
                                      textAlign: columnAlignments && columnAlignments[cIndex] ? columnAlignments[cIndex] : 'right',
                                      verticalAlign: columnVerticalAlignments && columnVerticalAlignments[cIndex] ? columnVerticalAlignments[cIndex] : 'bottom',
                                      outline: 'none',
                                      boxShadow: 'none',
                                      color: customColor ? customColor : (isCalculated ? 'var(--accent)' : '#fff'),
                                      cursor: 'text',
                                      flex: 1,
                                      minWidth: 0,
                                      background: 'transparent'
                                   }}
                                />
                                {cIndex === 11 && cellVal && cellVal.toString().trim() !== "" && cellVal !== "." && (
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       navigator.clipboard.writeText(cellVal.toString().trim());
                                       const btn = e.currentTarget;
                                       const originalColor = btn.style.color;
                                       btn.style.color = '#10b981'; // Green for success
                                       setTimeout(() => {
                                          if (btn) btn.style.color = originalColor;
                                       }, 1000);
                                     }}
                                     className="mini-copy-btn"
                                     title="Copy Plot No"
                                     style={{
                                       background: 'transparent',
                                       border: 'none',
                                       color: 'var(--accent)',
                                       cursor: 'pointer',
                                       padding: '0 4px',
                                       display: 'flex',
                                       alignItems: 'center',
                                       justifyContent: 'center',
                                       transition: 'color 0.2s'
                                     }}
                                   >
                                     <Copy size={14} />
                                   </button>
                                )}
                             </div>
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
