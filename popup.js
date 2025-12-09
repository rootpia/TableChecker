document.addEventListener('DOMContentLoaded', () => {
    const checkButton = document.getElementById('checkButton');
    const thresholdInput = document.getElementById('thresholdInput');
    const resultsDiv = document.getElementById('results');

    checkButton.addEventListener('click', () => {
        // 結果表示エリアをリセット
        resultsDiv.innerHTML = 'チェック中...';
        checkButton.disabled = true;

        // 閾値取得
        const thresholdMinutes = parseInt(thresholdInput.value, 10);
        if (isNaN(thresholdMinutes) || thresholdMinutes < 0) {
            resultsDiv.innerHTML = '<span class="error">0以上の閾値を入力してください</span>';
            checkButton.disabled = false;
            return;
        }

        // 1. アクティブなタブを取得
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                resultsDiv.innerHTML = '<span class="error">アクティブなタブが見つかりません。</span>';
                checkButton.disabled = false;
                return;
            }
            const activeTabId = tabs[0].id;

            // 2. アクティブなタブにチェック関数を注入して実行
            chrome.scripting.executeScript(
                {
                    target: { tabId: activeTabId },
                    // 実行する関数を定義
                    func: checkTableIntegrity, 
                    args: [thresholdMinutes]
                },
                (injectionResults) => {
                    checkButton.disabled = false;
                    if (chrome.runtime.lastError || !injectionResults || injectionResults.length === 0) {
                        resultsDiv.innerHTML = `<span class="error">スクリプト実行エラー: ${chrome.runtime.lastError?.message || '不明なエラー'}</span>`;
                        return;
                    }
                    
                    // 3. 結果の表示
                    displayResults(injectionResults[0].result);
                }
            );
        });
    });
});


/**
 * Webページに注入され、表の整合性をチェックする関数。
 * @param {number} thresholdMinutes - 実行時に指定された閾値（分）
 * @returns {Array<string>} 検出されたエラーメッセージの配列
 */
function checkTableIntegrity(thresholdMinutes) {
    const errors = [];

    // 定数定義
    const targetTableId = 'my-specific-data-table'; 
    const checkboxCol = 0
    const timeIdStartCol = 0
    const timeIdEndCol = 1
    const timePcStartCol = 2
    const timePcEndCol = 3
    const timeApStartCol = 4
    const timeApEndCol = 5

    // Table取得
    const targetTable = document.getElementById(targetTableId);
    if (!targetTable || targetTable.tagName !== 'TABLE') {
        errors.push(`🚨 ID '${targetTableId}' のテーブルが見つかりませんでした。`);
        return errors;
    }

    // --- ユーティリティ関数 ---
    /**
     * 時刻文字列 (HH:MM) を「00:00からの経過分数」に変換する関数
     * 無効なフォーマットや空文字列の場合は NaN を返す
     */
    const timeToMinutes = (timeStr) => {
        if (timeStr === '') return NaN; // 空文字列はNaNとして扱う
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            if (!isNaN(hours) && !isNaN(minutes)) {
                return hours * 60 + minutes;
            }
        }
        return NaN;
    };
    // -------------------------

    // 各行を順番にチェック
    const rows = targetTable.querySelectorAll('tr');
    for (let i = 1; i < rows.length; i++) {   // 行は1オリジン
        const row = rows[i];
        const cells = row.querySelectorAll('td, th');
        let rowError = 0; // 該当行にエラーがあったかどうかのフラグ
        
        // 1. 各時刻を取得
        const timeA = timeToMinutes(cells[timeIdStartCol].textContent.trim());
        const timeB = timeToMinutes(cells[timeIdEndCol].textContent.trim());
        const timeC = timeToMinutes(cells[timePcStartCol].textContent.trim());
        const timeD = timeToMinutes(cells[timePcEndCol].textContent.trim());
        const timeE = timeToMinutes(cells[timeApStartCol].textContent.trim());
        const timeF = timeToMinutes(cells[timeApEndCol].textContent.trim());

        // 値が不正な場合はスキップ
        if ([timeE, timeF].some(isNaN)) {
            if (isNaN(timeE)) {
                errors.push(`Row ${i} : 開始時刻エラー`);
                row.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
                cells[timeApStartCol].style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            }
            if (isNaN(timeF)) {
                errors.push(`Row ${i} : 終了時刻エラー`);
                row.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
                cells[timeApEndCol].style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            }
            continue;
        }

        // 2. 有効な時刻を取得
        let timeStart = NaN;
        let timeEnd = NaN;

        // 開始時刻
        if (isNaN(timeA) && !isNaN(timeC)) {
            timeStart = timeC;
        } else if (!isNaN(timeA) && isNaN(timeC)) {
            timeStart = timeA;
        } else if (!isNaN(timeA) && !isNaN(timeC)) {
            timeStart = Math.min(timeA, timeC);
        } else {
            timeStart = NaN;
        }
        // 終了時刻
        if (isNaN(timeB) && !isNaN(timeD)) {
            timeEnd = timeD;
        } else if (!isNaN(timeB) && isNaN(timeD)) {
            timeEnd = timeB;
        } else if (!isNaN(timeB) && !isNaN(timeD)) {
            timeEnd = Math.max(timeB, timeD);
        } else {
            timeEnd = NaN;
        }

        // 3. チェック条件１: 開始時刻(客観) < 開始時刻(申請) < 開始時刻(客観)＋30分
        if (!isNaN(timeStart)) {
            if (timeE < timeStart || timeE > (timeStart + thresholdMinutes)) {
                errors.push(`Row ${i} : 開始時刻エラー`);
                rowError = 1;
            }
        }

        // 4. チェック条件２: 終了時刻(客観) - 30分 < 終了時刻(申請) < 終了時刻(客観)
        if (!isNaN(timeEnd)) {
            if (timeF < (timeEnd - thresholdMinutes) || timeF > timeEnd) {
                errors.push(`Row ${i} : 終了時刻エラー`);
                rowError = 2;
            }
        }

        // 5. セル内のチェックボックスを取得
        //const checkbox = cells[checkboxCol].querySelector('input[type="checkbox"]');

        // 6. エラーがない場合、チェックを入れる
        if (rowError==0) {
            //checkbox.checked = true;

        // 7. エラーがある場合、視覚的に強調
        } else {
            row.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            if (rowError==1) {
                cells[timeApStartCol].style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            }
            if (rowError==2) {
                cells[timeApEndCol].style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            }
        }
    }
    
    // エラーが検出されなかった場合の処理
    if (errors.length === 0) {
        errors.push(`✅ 整合性エラーなし`);
    }

    return errors;
}


/**
 * チェック結果（エラー配列）をポップアップに表示する
 * @param {Array<string>} results - checkTableIntegrityから返された結果配列
 */
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; // クリア

    if (results.length === 0) {
        resultsDiv.innerHTML = '<span class="error">not implemented pattern</span>';
    } else if (results.length === 1 && results[0].startsWith('🚨')) {
        // テーブルが見つからなかった場合
         resultsDiv.innerHTML = `<span class="error">${results[0]}</span>`;
    } else if (results.length === 1 && results[0].startsWith('✅')) {
        // エラーがなかった場合
         resultsDiv.innerHTML = `<span class="success">${results[0]}</span>`;
    } else {
        resultsDiv.innerHTML = `<span class="error">${results.length} 件の整合性エラーが見つかりました。</span><hr>`;
        const ul = document.createElement('ul');
        results.forEach(msg => {
            const li = document.createElement('li');
            li.textContent = msg;
            ul.appendChild(li);
        });
        resultsDiv.appendChild(ul);
    }
}
