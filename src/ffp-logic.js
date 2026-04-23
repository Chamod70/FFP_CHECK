export function vlookup(lookupValue, sheetData, lookupColIndex, returnColIndex) {
  if (!lookupValue || !sheetData) return "";
  for (let i = 0; i < sheetData.length; i++) {
    if (sheetData[i][lookupColIndex] === lookupValue) {
      return sheetData[i][returnColIndex] || "";
    }
  }
  return "";
}

export function maxifs(maxRangeCol, criteriaRangeCol, criteriaValue, sheetData) {
  if (!sheetData) return "";
  let maxTime = -Infinity;
  let found = false;
  let resultValue = "";

  const parseToTime = (val) => {
    if (!val) return NaN;
    // If it's an Excel serial number (e.g. 45000+)
    if (!isNaN(val) && parseFloat(val) > 20000) {
      return (parseFloat(val) - 25569) * 86400 * 1000;
    }
    // If it's a string date (e.g. DD/MM/YYYY)
    if (typeof val === 'string' && val.includes('/')) {
      const parts = val.split('/');
      if (parts.length === 3) {
        // Handle DD/MM/YYYY
        const d = new Date(parts[2], parts[1] - 1, parts[0]);
        return d.getTime();
      }
    }
    // Fallback to standard JS parsing
    const d = new Date(val);
    return d.getTime();
  };

  for (let i = 0; i < sheetData.length; i++) {
    if (String(sheetData[i][criteriaRangeCol]).trim() === String(criteriaValue).trim()) {
      let time = parseToTime(sheetData[i][maxRangeCol]);
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

export function sumifs_ins(insSheetData, valL, valA) {
  if (!insSheetData) return "";
  let sum = 0;
  let found = false;
  for (let i = 0; i < insSheetData.length; i++) {
    let colE = insSheetData[i][4]; // E=4
    let colC = insSheetData[i][2]; // C=2
    let colI = parseFloat(insSheetData[i][8]); // I=8

    if (colE === valL) {
      if (colC > valA) {
        if (!isNaN(colI)) {
          sum += colI;
          found = true;
        }
      }
    }
  }
  return found ? sum : "";
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
  
  r[38] = manual[38] !== "" ? manual[38] : sumifs_ins(ins, L, r[0]); // AM
  
  // AN:AQ (39-42) unchanged
  // AR:AT (43-45) unchanged just in case
  
  return r;
};
