/**
 * テーブル設定の定義
 * 各モードごとのテーブルID、列番号を定義
 */
const TABLE_CONFIGS = {
    approver: {
        id: 'my-specific-data-table',
        name: '承認者モード',
        columns: {
            checkbox: 0,
            timeIdStart: 0,
            timeIdEnd: 1,
            timePcStart: 2,
            timePcEnd: 3,
            timeApStart: 4,
            timeApEnd: 5
        }
    },
    user: {
        id: 'user-data-table',
        name: 'ユーザモード',
        columns: {
            checkbox: 0,
            timeIdStart: 0,
            timeIdEnd: 1,
            timePcStart: 2,
            timePcEnd: 3,
            timeApStart: 4,
            timeApEnd: 5
        }
    }
};


/**
 * 時刻文字列 (HH:MM) を「00:00からの経過分数」に変換
 * @param {string} timeStr - 時刻文字列
 * @returns {number} 経過分数、無効な場合はNaN
 */
function timeToMinutes(timeStr) {
    if (timeStr === '') return NaN;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
            return hours * 60 + minutes;
        }
    }
    return NaN;
}


/**
 * テーブルが存在するかチェックし、該当する設定を返す
 * @returns {Object|null} {config, mode, table} または null
 */
function detectTable() {
    for (const [mode, config] of Object.entries(TABLE_CONFIGS)) {
        const table = document.getElementById(config.id);
        if (table && table.tagName === 'TABLE') {
            return { config, mode, table };
        }
    }
    return null;
}


/**
 * テーブルの整合性チェックを実行
 * @param {HTMLTableElement} table - チェック対象のテーブル
 * @param {Object} config - テーブル設定
 * @param {number} thresholdMinutes - 閾値（分）
 * @returns {Array<string>} エラーメッセージの配列
 */
function performTableCheck(table, config, thresholdMinutes) {
    const errors = [];
    const cols = config.columns;
    const rows = table.querySelectorAll('tr');

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll('td, th');
        let rowError = 0;
        
        // 各時刻を取得
        const timeA = timeToMinutes(cells[cols.timeIdStart].textContent.trim());
        const timeB = timeToMinutes(cells[cols.timeIdEnd].textContent.trim());
        const timeC = timeToMinutes(cells[cols.timePcStart].textContent.trim());
        const timeD = timeToMinutes(cells[cols.timePcEnd].textContent.trim());
        const timeE = timeToMinutes(cells[cols.timeApStart].textContent.trim());
        const timeF = timeToMinutes(cells[cols.timeApEnd].textContent.trim());

        // 申請時刻の妥当性チェック
        if ([timeE, timeF].some(isNaN)) {
            if (isNaN(timeE)) {
                errors.push(`Row ${i} : 開始時刻エラー`);
                row.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
                cells[cols.timeApStart].style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            }
            if (isNaN(timeF)) {
                errors.push(`Row ${i} : 終了時刻エラー`);
                row.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
                cells[cols.timeApEnd].style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            }
            continue;
        }

        // 有効な開始/終了時刻を決定
        let timeStart = NaN;
        let timeEnd = NaN;

        if (isNaN(timeA) && !isNaN(timeC)) {
            timeStart = timeC;
        } else if (!isNaN(timeA) && isNaN(timeC)) {
            timeStart = timeA;
        } else if (!isNaN(timeA) && !isNaN(timeC)) {
            timeStart = Math.min(timeA, timeC);
        }

        if (isNaN(timeB) && !isNaN(timeD)) {
            timeEnd = timeD;
        } else if (!isNaN(timeB) && isNaN(timeD)) {
            timeEnd = timeB;
        } else if (!isNaN(timeB) && !isNaN(timeD)) {
            timeEnd = Math.max(timeB, timeD);
        }

        // チェック条件１: 開始時刻
        if (!isNaN(timeStart)) {
            if (timeE < timeStart || timeE > (timeStart + thresholdMinutes)) {
                errors.push(`Row ${i} : 開始時刻エラー`);
                rowError = 1;
            }
        }

        // チェック条件２: 終了時刻
        if (!isNaN(timeEnd)) {
            if (timeF < (timeEnd - thresholdMinutes) || timeF > timeEnd) {
                errors.push(`Row ${i} : 終了時刻エラー`);
                rowError = 2;
            }
        }

        // エラー時の視覚的強調
        if (rowError > 0) {
            row.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            if (rowError === 1) {
                cells[cols.timeApStart].style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            }
            if (rowError === 2) {
                cells[cols.timeApEnd].style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            }
        }
    }
    
    if (errors.length === 0) {
        errors.push(`✅ 整合性エラーなし`);
    }

    return errors;
}


/**
 * メイン処理: テーブルの整合性をチェック
 * windowオブジェクトに公開して、popup.jsから呼び出せるようにする
 * @param {number} thresholdMinutes - 閾値（分）
 * @returns {Object} {mode, errors}
 */
window.checkTableIntegrity = function(thresholdMinutes) {
    const detected = detectTable();

    if (!detected) {
        const searchedIds = Object.values(TABLE_CONFIGS).map(c => c.id).join(', ');
        return {
            mode: null,
            errors: [`🚨 対応するテーブルが見つかりませんでした。(検索対象ID: ${searchedIds})`]
        };
    }

    const errors = performTableCheck(detected.table, detected.config, thresholdMinutes);
    
    return {
        mode: detected.config.name,
        errors: errors
    };
};
