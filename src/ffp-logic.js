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

export const evaluateRow = (row, sheets) => {
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
  
  let L = r[11]; // Plot No (L)

  // CRITICAL: If Plot No is empty, stop and return only manual inputs or blanks
  if (!L || L.toString().trim() === "" || L === ".") {
    return r.map(cell => (cell === 0 || cell === "." ? "" : cell));
  }

  const hcomp = sheets["H.COMP"];
  const mast = sheets["MAST"];
  const wbt = sheets["WBT"];
  const ext = sheets["EXT"];
  const rate = sheets["RATE"];
  const wbt2 = sheets["WBT2"] || sheets["WBT 2"] || sheets["WBT"];
  const ins = sheets["INS"];

  r[0] = manual[0] !== "" ? manual[0] : (vlookup(L, hcomp, 0, 1)); // A
  // r[1] (B) logic moved down after r[23] calculation
  
  let cVal = vlookup(L, mast, 0, 3); // C (D column in MAST -> D=3)
  r[2] = manual[2] !== "" ? manual[2] : (cVal === 0 || cVal === "" ? "" : cVal); 
  
  r[3] = manual[3] !== "" ? manual[3] : maxifs(7, 19, L, wbt); // D
  
  // E:L (4-11) is unchanged
  // Calculation for H (index 7): IF(D=E, "", "H/WRONG")
  let valD = String(r[3]).trim();
  let valE = String(r[4]).trim();
  r[7] = manual[7] !== "" ? manual[7] : (valD === valE ? "" : "H/WRONG");

  r[12] = manual[12] !== "" ? manual[12] : (vlookup(L, mast, 0, 1)); // M
  r[13] = manual[13] !== "" ? manual[13] : (vlookup(L, mast, 0, 7)); // N
  r[14] = manual[14] !== "" ? manual[14] : (vlookup(L, mast, 0, 2)); // O
  
  r[15] = manual[15] !== "" ? manual[15] : (vlookup(L, ext, 4, 16)); // P (E=4, Q=16)
  
  let qVal = vlookup(L, rate, 1, 18); // Q (B=1, S=18)
  r[16] = manual[16] !== "" ? manual[16] : (qVal === 0 || qVal === "" ? "" : qVal);
  
  // R:U (17-20) unchanged
  // V (index 21) = SUMIF(WBT2!T:T, L, WBT2!Y:Y)/1000
  const wbt2Sheet = sheets["WBT2"] || sheets["WBT 2"] || [];
  r[21] = manual[21] !== "" ? manual[21] : (sumif(19, L, 24, wbt2Sheet) / 1000 || ""); // V (col 22) - SUMIF WBT2!T=L, sum WBT2!Y /1000

  r[22] = manual[22] !== "" ? manual[22] : (sumif(19, L, 24, wbt) / 1000 || ""); // W (col 23)
  r[23] = manual[23] !== "" ? manual[23] : ((num(r[18]) + num(r[19]) + num(r[20]) + num(r[21]) + num(r[22])) || ""); // X = S+T+U+V+W
  
  // New logic for Column 2 (PART - index 1)
  const categoryMatch = vlookup(L, wbt, 19, 21);
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
  
  r[24] = manual[24] !== "" ? manual[24] : (((num(r[19]) * 9150) + sumif(19, L, 25, wbt2) + sumif(19, L, 25, wbt)) || ""); // Y
  r[25] = manual[25] !== "" ? manual[25] : (((num(r[22]) + num(r[21])) * 1000) || ""); // Z
  r[26] = manual[26] !== "" ? manual[26] : (((num(r[22]) + num(r[21])) * 1500) || ""); // AA
  r[27] = manual[27] !== "" ? manual[27] : ((((num(r[22]) + num(r[21])) * 2500) + (num(r[19]) * 2000)) || ""); // AB
  
  // AC:AG (28-32)
  r[28] = manual[28]; // MTL Rec (index 28, col 29)
  
  // Column 30 (index 29) = Manual STL Total - Sum(Col 31 to 36)
  const stlTotal = num(manual[29]);
  const sumOtherRecoveries = num(r[30]) + num(r[31]) + num(r[32]) + num(r[33]) + num(r[34]) + num(r[35]);
  let stlResult = manual[29] !== "" ? (stlTotal - sumOtherRecoveries) : "";
  
  r[29] = preserveManual(manual[29], stlResult);
  if (r[29] === 0 && manual[29] !== "") r[29] = "0"; // Show 0 if it reached zero
  
  // AU evaluated first to use in AH
  r[46] = manual[46] !== "" ? manual[46] : (vlookup(L, wbt, 19, 21)); // AU (T=19, V=21)
  
  r[33] = manual[33] !== "" ? manual[33] : (r[46] === "Machine Harvested" ? "MA" : ""); // AH
  
  // AI:AK (34-36) unchanged
  
  let deductions = num(r[27]) + num(r[28]) + num(r[29]) + num(r[30]) + num(r[31]) + num(r[32]) + (r[33] === "MA" ? 0 : num(r[33])) + num(r[34]) + num(r[35]) + num(r[36]);
  let balanceResult = manual[37] !== "" ? manual[37] : ((num(r[24]) + num(r[25]) + num(r[26])) - deductions);
  r[37] = manual[37] !== "" ? manual[37] : (balanceResult === 0 ? "0.00" : (balanceResult || "")); // AL
  
  r[38] = manual[38] !== "" ? manual[38] : sumifs_ins(ins, L, r[0]); // AM
  
  // AN:AQ (39-42) unchanged
  // AR:AT (43-45) unchanged just in case
  
  return r;
};
