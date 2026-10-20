export function vlookup(lookupValue, sheetData, lookupColIndex, returnColIndex) {
  if (!lookupValue || !sheetData) return "";
  for (let i = 0; i < sheetData.length; i++) {
    if (sheetData[i][lookupColIndex] === lookupValue) {
      return sheetData[i][returnColIndex] || "";
    }
  }
  return "";
}

export const parseDate = (val) => {
  if (val === undefined || val === null) return NaN;
  let str = String(val).trim();
  if (str === "" || str === "." || str === "-" || str === "0") return NaN;

  // Handle number (Excel serial)
  if (typeof val === 'number') {
    if (val > 1000) return Math.round((val - 25569) * 86400 * 1000);
    return NaN;
  }

  // Handle string that is a number (Excel serial in string form)
  if (!isNaN(str) && !str.includes('/') && !str.includes('-')) {
    let p = parseFloat(str);
    if (p > 1000) return Math.round((p - 25569) * 86400 * 1000);
  }

  // Remove leading - if present
  if (str.startsWith('-')) str = str.substring(1).trim();

  // Manual parse for DD/MM/YYYY or MM/DD/YYYY or MM/DD
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      let p0 = parseInt(parts[0]);
      let p1 = parseInt(parts[1]);
      let p2 = parseInt(parts[2]);
      if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
        if (p2 < 100) p2 += 2000;
        
        if (p1 > 12) {
          const d = new Date(p2, p0 - 1, p1);
          if (!isNaN(d.getTime())) return d.getTime();
        } 
        else if (p0 > 12) {
          const d = new Date(p2, p1 - 1, p0);
          if (!isNaN(d.getTime())) return d.getTime();
        } 
        else {
          let d = new Date(p2, p0 - 1, p1);
          if (!isNaN(d.getTime())) return d.getTime();
        }
      }
    } else if (parts.length === 2) {
      // Handle MM/DD and assume current year (2026)
      let p0 = parseInt(parts[0]);
      let p1 = parseInt(parts[1]);
      if (!isNaN(p0) && !isNaN(p1)) {
        const currentYear = 2026;
        // Try MM/DD first
        let d = new Date(currentYear, p0 - 1, p1);
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }
  }

  const d = new Date(str);
  return d.getTime();
};

export const toYYYYMMDD = (val) => {
  const time = parseDate(val);
  if (isNaN(time)) return null;
  const d = new Date(time);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return parseInt(`${y}${m}${day}`);
};

export function sumifs_ins(insSheetData, valL, valA) {
  if (!insSheetData || !Array.isArray(insSheetData)) return 0;
  
  let sum = 0;
  const targetPlot = String(valL || "").trim().toUpperCase();
  const targetDateNum = toYYYYMMDD(valA);
  
  if (!targetPlot || targetDateNum === null) return 0;

  for (let i = 0; i < insSheetData.length; i++) {
    const row = insSheetData[i];
    if (!Array.isArray(row) || row.length < 9) continue;

    let colE = String(row[4] || "").trim().toUpperCase(); // Plot No (E=4)
    if (colE === targetPlot) {
      let insDateNum = toYYYYMMDD(row[2]); // Date (C=2)
      let amount = parseFloat(String(row[8] || "0").replace(/,/g, '')) || 0;

      // Sum only if INS date is strictly AFTER target date
      if (insDateNum !== null && insDateNum > targetDateNum) {
        sum += amount;
      }
    }
  }
  return sum;
}

export function maxifs(maxRangeCol, criteriaRangeCol, criteriaValue, sheetData) {
  if (!sheetData) return "";
  let maxTime = -Infinity;
  let found = false;
  let resultValue = "";

  for (let i = 0; i < sheetData.length; i++) {
    if (String(sheetData[i][criteriaRangeCol]).trim() === String(criteriaValue).trim()) {
      let time = parseDate(sheetData[i][maxRangeCol]);
      if (!isNaN(time) && time > maxTime) {
        maxTime = time;
        resultValue = sheetData[i][maxRangeCol];
        found = true;
      }
    }
  }
  return found ? resultValue : "";
}

export function sumif(criteriaRangeCol, criteriaValue, sumRangeCol, sheetData) {
  if (!sheetData) return 0;
  let sum = 0;
  let found = false;
  for (let i = 0; i < sheetData.length; i++) {
    if (sheetData[i][criteriaRangeCol] === criteriaValue) {
      let val = parseFloat(sheetData[i][sumRangeCol]);
      if (!isNaN(val)) {
        sum += val;
        found = true;
      }
    }
  }
  return found ? sum : 0;
}

// Convert Excel serial date to readable string
export const excelDateToStr = (serial) => {
  if (!serial || isNaN(serial) || serial < 100) return serial;
  // Excel base date is 1899-12-30
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
};

// Convert row map to array ensuring all columns are available
export const ensureArray = (row, maxLen) => {
  let arr = [];
  for (let i=0; i<maxLen; i++) {
    arr[i] = row[i] !== undefined ? row[i] : (row[String(i)] !== undefined ? row[String(i)] : "");
  }
  return arr;
};

export function buildMasterIndexes(sheets) {
  if (!sheets) return null;

  // 1. H.COMP (col 0 -> col 1)
  const hcompMap = new Map();
  const hcomp = sheets["H.COMP"] || [];
  for (let i = 0; i < hcomp.length; i++) {
    const row = hcomp[i];
    if (row && row[0] !== undefined && row[0] !== null) {
      const k = String(row[0]).trim();
      if (k && !hcompMap.has(k)) {
        hcompMap.set(k, row[1] || "");
      }
    }
  }

  // 2. MAST (col 0 -> row)
  const mastMap = new Map();
  const mast = sheets["MAST"] || [];
  for (let i = 0; i < mast.length; i++) {
    const row = mast[i];
    if (row && row[0] !== undefined && row[0] !== null) {
      const k = String(row[0]).trim();
      if (k && !mastMap.has(k)) {
        mastMap.set(k, row);
      }
    }
  }

  // 3. EXT (col 4 -> col 16)
  const extMap = new Map();
  const ext = sheets["EXT"] || [];
  for (let i = 0; i < ext.length; i++) {
    const row = ext[i];
    if (row && row[4] !== undefined && row[4] !== null) {
      const k = String(row[4]).trim();
      if (k && !extMap.has(k)) {
        extMap.set(k, row[16] || "");
      }
    }
  }

  // 4. RATE (col 1 -> col 18)
  const rateMap = new Map();
  const rate = sheets["RATE"] || [];
  for (let i = 0; i < rate.length; i++) {
    const row = rate[i];
    if (row && row[1] !== undefined && row[1] !== null) {
      const k = String(row[1]).trim();
      if (k && !rateMap.has(k)) {
        rateMap.set(k, row[18] || "");
      }
    }
  }

  // 5. WBT (col 19 -> { maxD_val, maxD_time, sum24, sum25, category })
  const wbtMap = new Map();
  const wbt = sheets["WBT"] || [];
  for (let i = 0; i < wbt.length; i++) {
    const row = wbt[i];
    if (!row || row[19] === undefined || row[19] === null) continue;
    const k = String(row[19]).trim();
    if (!k) continue;

    let entry = wbtMap.get(k);
    if (!entry) {
      entry = {
        maxD_val: "",
        maxD_time: -Infinity,
        sum24: 0,
        sum25: 0,
        category: row[21] || ""
      };
      wbtMap.set(k, entry);
    }

    const time = parseDate(row[7]);
    if (!isNaN(time) && time > entry.maxD_time) {
      entry.maxD_time = time;
      entry.maxD_val = row[7];
    }

    const v24 = parseFloat(row[24]);
    if (!isNaN(v24)) entry.sum24 += v24;

    const v25 = parseFloat(row[25]);
    if (!isNaN(v25)) entry.sum25 += v25;
  }

  // 6. WBT2 (col 19 -> { sum24, sum25 })
  const wbt2Map = new Map();
  const wbt2 = sheets["WBT2"] || sheets["WBT 2"] || sheets["WBT"] || [];
  for (let i = 0; i < wbt2.length; i++) {
    const row = wbt2[i];
    if (!row || row[19] === undefined || row[19] === null) continue;
    const k = String(row[19]).trim();
    if (!k) continue;

    let entry = wbt2Map.get(k);
    if (!entry) {
      entry = { sum24: 0, sum25: 0 };
      wbt2Map.set(k, entry);
    }
    const v24 = parseFloat(row[24]);
    if (!isNaN(v24)) entry.sum24 += v24;

    const v25 = parseFloat(row[25]);
    if (!isNaN(v25)) entry.sum25 += v25;
  }

  // 7. INS (group by Plot No col 4, pre-parsed)
  const insMap = new Map();
  const ins = sheets["INS"] || [];
  for (let i = 0; i < ins.length; i++) {
    const row = ins[i];
    if (!Array.isArray(row) || row.length < 9) continue;
    const k = String(row[4] || "").trim().toUpperCase();
    if (!k) continue;

    const insDateNum = toYYYYMMDD(row[2]);
    const amount = parseFloat(String(row[8] || "0").replace(/,/g, '')) || 0;

    let list = insMap.get(k);
    if (!list) {
      list = [];
      insMap.set(k, list);
    }
    list.push({ dateNum: insDateNum, amount });
  }

  // 8. FFP Summary (col 3 Sheet No -> extracted fields)
  const ffpSummaryBySheetNo = new Map();
  const summarySheet = sheets['FFP Summary'] || [];
  for (let i = 0; i < summarySheet.length; i++) {
    const row = summarySheet[i];
    if (!row || row[3] === undefined || row[3] === null) continue;
    const sNo = String(row[3]).trim();
    if (!sNo || ffpSummaryBySheetNo.has(sNo)) continue;

    let harvestDate = row[5];
    if (harvestDate && typeof harvestDate === 'string' && harvestDate.includes('-')) {
      const parts = harvestDate.split('-');
      if (parts.length === 3) {
        harvestDate = `${parts[1]}/${parts[2]}/${parts[0]}`;
      }
    }

    ffpSummaryBySheetNo.set(sNo, {
      plotNo: row[0] || "",
      harvestDate: harvestDate || "",
      harvestAdv: row[10] || "",
      interest: row[13] || "",
      bankedAmount: row[14] || ""
    });
  }

  return {
    hcompMap,
    mastMap,
    extMap,
    rateMap,
    wbtMap,
    wbt2Map,
    insMap,
    ffpSummaryBySheetNo
  };
}

export const evaluateRow = (row, sheets, indexes = null) => {
  let r = ensureArray(row, 47);
  let manual = [...r]; // Keep track of manually entered values
  let num = (val) => {
    if (typeof val === 'string') {
      val = val.replace(/,/g, '').trim();
      if (val === "." || val === "-" || val === "") return 0;
    }
    let p = parseFloat(val);
    return isNaN(p) ? 0 : p;
  };
  
  // Helper to preserve manual input like "." during typing
  let preserveManual = (manualVal, calculatedVal) => {
    if (manualVal === "." || manualVal === "-") return manualVal;
    if (typeof manualVal === 'string' && manualVal.endsWith(".")) return manualVal;
    return calculatedVal;
  };
  
  let ffpSummaryPlotNo = "";
  let ffpSummaryHarvestDate = "";
  let ffpSummaryHarvestAdv = "";
  let ffpSummaryInterest = "";

  const sNo = (r[5] && r[5].toString().trim() !== "" && r[5] !== ".") ? r[5].toString().trim() : null;

  if (sNo) {
    if (indexes && indexes.ffpSummaryBySheetNo) {
      const sItem = indexes.ffpSummaryBySheetNo.get(sNo);
      if (sItem) {
        ffpSummaryPlotNo = sItem.plotNo;
        ffpSummaryHarvestDate = sItem.harvestDate;
        ffpSummaryHarvestAdv = sItem.harvestAdv;
        ffpSummaryInterest = sItem.interest;
      }
    } else if (sheets['FFP Summary']) {
      let summarySheet = sheets['FFP Summary'];
      for(let i=0; i<summarySheet.length; i++) {
        if (summarySheet[i][3] != null && summarySheet[i][3].toString().trim() === sNo) {
          ffpSummaryPlotNo = summarySheet[i][0];
          let rawDate = summarySheet[i][5];
          if (rawDate && typeof rawDate === 'string' && rawDate.includes('-')) {
            let parts = rawDate.split('-');
            if (parts.length === 3) {
              ffpSummaryHarvestDate = `${parts[1]}/${parts[2]}/${parts[0]}`;
            } else {
              ffpSummaryHarvestDate = rawDate;
            }
          } else {
            ffpSummaryHarvestDate = rawDate;
          }
          ffpSummaryHarvestAdv = summarySheet[i][10];
          ffpSummaryInterest = summarySheet[i][13];
          break;
        }
      }
    }
  }

  if (ffpSummaryPlotNo !== "" && ffpSummaryPlotNo != null) {
      r[11] = ffpSummaryPlotNo;
  } else {
      r[11] = manual[11];
  }
  
  let L = r[11]; // Plot No (L)
  const lStr = L ? String(L).trim() : "";

  // CRITICAL: If Plot No is empty, stop and return only manual inputs or blanks
  if (!L || lStr === "" || L === ".") {
    return r.map(cell => (cell === 0 || cell === "." ? "" : cell));
  }

  const hcomp = sheets["H.COMP"];
  const mast = sheets["MAST"];
  const wbt = sheets["WBT"];
  const ext = sheets["EXT"];
  const rate = sheets["RATE"];
  const wbt2 = sheets["WBT2"] || sheets["WBT 2"] || sheets["WBT"];
  const ins = sheets["INS"];

  // Fast lookups if indexes exist
  const hcompVal = indexes ? indexes.hcompMap.get(lStr) : vlookup(L, hcomp, 0, 1);
  r[0] = manual[0] !== "" ? manual[0] : (hcompVal || ""); // A
  
  const mastRow = indexes ? indexes.mastMap.get(lStr) : null;
  let cVal = mastRow ? mastRow[3] : vlookup(L, mast, 0, 3); // C (D column in MAST -> D=3)
  r[2] = manual[2] !== "" ? manual[2] : (cVal === 0 || cVal === "" || cVal === undefined ? "" : cVal); 
  
  const wbtEntry = indexes ? indexes.wbtMap.get(lStr) : null;
  r[3] = manual[3] !== "" ? manual[3] : (wbtEntry ? wbtEntry.maxD_val : maxifs(7, 19, L, wbt)); // D
  
  if (ffpSummaryHarvestDate !== "" && ffpSummaryHarvestDate != null) {
      r[4] = manual[4] !== "" ? manual[4] : ffpSummaryHarvestDate;
  } else {
      r[4] = manual[4];
  }
  
  // Calculation for H (index 7): IF(D=E, "", "H/WRONG")
  let valD = String(r[3]).trim();
  let valE = String(r[4]).trim();
  let dateD = toYYYYMMDD(r[3]);
  let dateE = toYYYYMMDD(r[4]);
  
  if (dateD !== null && dateE !== null) {
    r[7] = manual[7] !== "" ? manual[7] : (dateD === dateE ? "" : "H/WRONG");
  } else {
    r[7] = manual[7] !== "" ? manual[7] : (valD === valE ? "" : "H/WRONG");
  }

  r[12] = manual[12] !== "" ? manual[12] : (mastRow ? mastRow[1] : vlookup(L, mast, 0, 1)); // M
  r[13] = manual[13] !== "" ? manual[13] : (mastRow ? mastRow[7] : vlookup(L, mast, 0, 7)); // N
  r[14] = manual[14] !== "" ? manual[14] : (mastRow ? mastRow[2] : vlookup(L, mast, 0, 2)); // O
  
  r[15] = manual[15] !== "" ? manual[15] : (indexes ? (indexes.extMap.get(lStr) || "") : vlookup(L, ext, 4, 16)); // P (E=4, Q=16)
  
  let qVal = indexes ? indexes.rateMap.get(lStr) : vlookup(L, rate, 1, 18); // Q (B=1, S=18)
  r[16] = manual[16] !== "" ? manual[16] : (qVal === 0 || qVal === "" || qVal === undefined ? "" : qVal);
  
  // R:U (17-20) unchanged
  // V (index 21) = SUMIF(WBT2!T:T, L, WBT2!Y:Y)/1000
  const wbt2Entry = indexes ? indexes.wbt2Map.get(lStr) : null;
  const wbt2Sheet = sheets["WBT2"] || sheets["WBT 2"] || [];
  const sumWbt2_24 = wbt2Entry ? wbt2Entry.sum24 : sumif(19, L, 24, wbt2Sheet);
  r[21] = manual[21] !== "" ? manual[21] : ((sumWbt2_24 / 1000) || ""); // V (col 22)

  const sumWbt_24 = wbtEntry ? wbtEntry.sum24 : sumif(19, L, 24, wbt);
  r[22] = manual[22] !== "" ? manual[22] : ((sumWbt_24 / 1000) || ""); // W (col 23)
  r[23] = manual[23] !== "" ? manual[23] : ((num(r[18]) + num(r[19]) + num(r[20]) + num(r[21]) + num(r[22])) || ""); // X = S+T+U+V+W
  
  // New logic for Column 2 (PART - index 1)
  const categoryMatch = wbtEntry ? wbtEntry.category : vlookup(L, wbt, 19, 21);
  if (categoryMatch === "Machine Harvested") {
    const totalX = num(r[23]);
    const extentP = num(r[15]);
    if (extentP > 0) {
      const res = totalX / extentP;
      let valB = "";
      if (res > 100) valB = 1600;
      else if (res >= 80) valB = 1700;
      else if (res >= 60) valB = 2000;
      else if (res >= 40) valB = 2500;
      else valB = 2900;
      r[1] = manual[1] !== "" ? manual[1] : valB;
    } else {
      r[1] = manual[1] !== "" ? manual[1] : "";
    }
  } else {
    r[1] = manual[1] !== "" ? manual[1] : "";
  }
  
  const sumWbt2_25 = wbt2Entry ? wbt2Entry.sum25 : sumif(19, L, 25, wbt2);
  const sumWbt_25 = wbtEntry ? wbtEntry.sum25 : sumif(19, L, 25, wbt);
  r[24] = manual[24] !== "" ? manual[24] : (((num(r[19]) * 9150) + sumWbt2_25 + sumWbt_25) || ""); // Y
  r[25] = manual[25] !== "" ? manual[25] : (((num(r[22]) + num(r[21])) * 1000) || ""); // Z
  r[26] = manual[26] !== "" ? manual[26] : (((num(r[22]) + num(r[21])) * 1500) || ""); // AA

  if (ffpSummaryHarvestAdv !== "" && ffpSummaryHarvestAdv != null) {
      r[27] = manual[27] !== "" ? manual[27] : ffpSummaryHarvestAdv;
  } else {
      r[27] = manual[27] !== "" ? manual[27] : ((((num(r[22]) + num(r[21])) * 2500) + (num(r[19]) * 2000)) || ""); // AB
  }
  
  // AC:AG (28-32)
  r[28] = manual[28]; // MTL Rec (index 28, col 29)
  
  // Column 30 (index 29) = Manual STL Total - Sum(Col 31 to 36)
  const stlTotal = num(manual[29]);
  const sumOtherRecoveries = num(r[30]) + num(r[31]) + num(r[32]) + num(r[33]) + num(r[34]) + num(r[35]);
  let stlResult = manual[29] !== "" ? (stlTotal - sumOtherRecoveries) : "";
  
  r[29] = preserveManual(manual[29], stlResult);
  if (r[29] === 0 && manual[29] !== "") r[29] = "0"; // Show 0 if it reached zero
  
  // AU evaluated first to use in AH
  r[46] = manual[46] !== "" ? manual[46] : categoryMatch; // AU (T=19, V=21)
  
  r[33] = manual[33] !== "" ? manual[33] : (r[46] === "Machine Harvested" ? "MA" : ""); // AH
  
  // AI:AJ (34-35) unchanged
  
  if (ffpSummaryInterest !== "" && ffpSummaryInterest != null) {
      r[36] = manual[36] !== "" ? manual[36] : ffpSummaryInterest;
  } else {
      r[36] = manual[36]; // Fallback to manual
  }

  let deductions = num(r[27]) + num(r[28]) + num(r[29]) + num(r[30]) + num(r[31]) + num(r[32]) + (r[33] === "MA" ? 0 : num(r[33])) + num(r[34]) + num(r[35]) + num(r[36]);
  let balanceResult = manual[37] !== "" ? manual[37] : ((num(r[24]) + num(r[25]) + num(r[26])) - deductions);
  r[37] = manual[37] !== "" ? manual[37] : (balanceResult === 0 ? "0.00" : (balanceResult || "")); // AL
  
  if (indexes && indexes.insMap) {
    const targetDateNum = toYYYYMMDD(r[0]);
    let insSum = 0;
    if (targetDateNum !== null) {
      const insList = indexes.insMap.get(lStr.toUpperCase()) || [];
      for (let i = 0; i < insList.length; i++) {
        if (insList[i].dateNum !== null && insList[i].dateNum > targetDateNum) {
          insSum += insList[i].amount;
        }
      }
    }
    r[38] = manual[38] !== "" ? manual[38] : insSum;
  } else {
    r[38] = manual[38] !== "" ? manual[38] : sumifs_ins(ins, L, r[0]); // AM
  }
  
  return r;
};
