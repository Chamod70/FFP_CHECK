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

  // Remove leading symbols like - if they are part of a date string (e.g. -11/8/2022)
  if (str.startsWith('-')) str = str.substring(1).trim();
  
  // Handle string that is a number (Excel serial in string form)
  if (!isNaN(str) && str !== "" && parseFloat(str) > 1000) {
    return Math.round((parseFloat(str) - 25569) * 86400 * 1000);
  }

  // Handle formats like DD/MM/YYYY or MM/DD/YYYY
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      let p0 = parseInt(parts[0]);
      let p1 = parseInt(parts[1]);
      let p2 = parseInt(parts[2]);
      if (isNaN(p0) || isNaN(p1) || isNaN(p2)) return NaN;

      if (p2 < 100) p2 += 2000;
      
      // Determine if it's MM/DD/YYYY or DD/MM/YYYY
      if (p1 > 12) {
        // MM/DD/YYYY
        const d = new Date(p2, p0 - 1, p1);
        if (!isNaN(d.getTime())) return d.getTime();
      } else if (p0 > 12) {
        // DD/MM/YYYY
        const d = new Date(p2, p1 - 1, p0);
        if (!isNaN(d.getTime())) return d.getTime();
      } else {
        // Ambiguous. Try standard parsing (MM/DD/YYYY) first
        let d = new Date(str);
        if (!isNaN(d.getTime())) return d.getTime();
        
        // Final fallback: assume DD/MM/YYYY
        d = new Date(p2, p1 - 1, p0);
        if (!isNaN(d.getTime())) return d.getTime();
      }
    }
  }

  // Fallback to standard JS parsing
  const d = new Date(str);
  return d.getTime();
};
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

export const toYYYYMMDD = (val) => {
  const time = parseDate(val);
  if (isNaN(time)) return null;
  const d = new Date(time);
  // Use UTC components to avoid timezone shifts
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return parseInt(`${y}${m}${day}`);
};

export function sumifs_ins(insSheetData, valL, valA) {
  if (!insSheetData || !Array.isArray(insSheetData)) return 0;
  
  let sum = 0;
  let found = false;
  
  const targetDateNum = toYYYYMMDD(valA);
  const targetPlot = String(valL || "").trim().toUpperCase();
  
  if (!targetPlot || targetDateNum === null) return 0;

  for (let i = 0; i < insSheetData.length; i++) {
    const row = insSheetData[i];
    // Skip if row is not an array or too short (needs at least index 8 for col I)
    if (!Array.isArray(row) || row.length < 9) continue;

    let colE = String(row[4] || "").trim().toUpperCase(); // Plot No (E=4)
    if (colE === targetPlot) {
      let insDateNum = toYYYYMMDD(row[2]); // Date (C=2)
      let colIStr = String(row[8] || "0").replace(/,/g, '').trim();
      let colI = parseFloat(colIStr); // Amount (I=8)

      // Compare YYYYMMDD integers: sum if INS date is strictly AFTER target date
      if (insDateNum !== null && insDateNum > targetDateNum) {
        if (!isNaN(colI)) {
          sum += colI;
          found = true;
        }
      }
    }
  }
  return sum || 0;
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
  r[1] = r[1] || ""; // B
  
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
  
  // R:V (17-21) unchanged
  r[22] = manual[22] !== "" ? manual[22] : (sumif(19, L, 24, wbt) / 1000 || ""); // W
  r[23] = manual[23] !== "" ? manual[23] : ((num(r[18]) + num(r[19]) + num(r[20]) + num(r[21]) + num(r[22])) || ""); // X = S+T+U+V+W
  
  r[24] = manual[24] !== "" ? manual[24] : (((num(r[19]) * 9150) + sumif(19, L, 25, wbt2) + sumif(19, L, 25, wbt)) || ""); // Y
  r[25] = manual[25] !== "" ? manual[25] : (((num(r[22]) + num(r[21])) * 1000) || ""); // Z
  r[26] = manual[26] !== "" ? manual[26] : (((num(r[22]) + num(r[21])) * 1500) || ""); // AA
  r[27] = manual[27] !== "" ? manual[27] : ((((num(r[22]) + num(r[21])) * 2500) + (num(r[19]) * 2000)) || ""); // AB
  
  // AC:AG (28-32) unchanged
  
  // AU evaluated first to use in AH
  r[46] = manual[46] !== "" ? manual[46] : (vlookup(L, wbt, 19, 21)); // AU (T=19, V=21)
  
  r[33] = manual[33] !== "" ? manual[33] : (r[46] === "Machine Harvested" ? "MA" : ""); // AH
  
  // AI:AK (34-36) unchanged
  
  let deductions = num(r[27]) + num(r[28]) + num(r[29]) + num(r[30]) + num(r[31]) + num(r[32]) + (r[33] === "MA" ? 0 : num(r[33])) + num(r[34]) + num(r[35]) + num(r[36]);
  r[37] = manual[37] !== "" ? manual[37] : (((num(r[24]) + num(r[25]) + num(r[26])) - deductions) || ""); // AL
  
  r[38] = sumifs_ins(ins, L, r[0]); // AM
  
  // AN:AQ (39-42) unchanged
  // AR:AT (43-45) unchanged just in case
  
  return r;
};
