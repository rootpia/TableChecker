document.addEventListener('DOMContentLoaded', () => {
    const checkButton = document.getElementById('checkButton');
    const thresholdInput = document.getElementById('thresholdInput');
    const resultsDiv = document.getElementById('results');

    checkButton.addEventListener('click', () => {
        resultsDiv.innerHTML = 'チェック中...';
        checkButton.disabled = true;

        const thresholdMinutes = parseInt(thresholdInput.value, 10);
        if (isNaN(thresholdMinutes) || thresholdMinutes < 0) {
            resultsDiv.innerHTML = '<span class="error">0以上の閾値を入力してください</span>';
            checkButton.disabled = false;
            return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                resultsDiv.innerHTML = '<span class="error">アクティブなタブが見つかりません。</span>';
                checkButton.disabled = false;
                return;
            }
            const activeTabId = tabs[0].id;

            // contentScript.jsを注入して実行
            chrome.scripting.executeScript(
                {
                    target: { tabId: activeTabId },
                    files: ['contentScript.js']
                },
                () => {
                    if (chrome.runtime.lastError) {
                        resultsDiv.innerHTML = `<span class="error">スクリプト注入エラー: ${chrome.runtime.lastError.message}</span>`;
                        checkButton.disabled = false;
                        return;
                    }

                    // 注入したスクリプト内の関数を実行
                    chrome.scripting.executeScript(
                        {
                            target: { tabId: activeTabId },
                            func: (threshold) => {
                                // contentScript.js内のcheckTableIntegrityを呼び出し
                                return window.checkTableIntegrity(threshold);
                            },
                            args: [thresholdMinutes]
                        },
                        (injectionResults) => {
                            checkButton.disabled = false;
                            if (chrome.runtime.lastError || !injectionResults || injectionResults.length === 0) {
                                resultsDiv.innerHTML = `<span class="error">実行エラー: ${chrome.runtime.lastError?.message || '不明なエラー'}</span>`;
                                return;
                            }
                            
                            displayResults(injectionResults[0].result);
                        }
                    );
                }
            );
        });
    });
});


/**
 * チェック結果をポップアップに表示
 * @param {Object} result - checkTableIntegrityから返された結果オブジェクト
 */
function displayResults(result) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    // モード表示
    if (result.mode) {
        const modeDiv = document.createElement('div');
        modeDiv.style.marginBottom = '10px';
        modeDiv.style.fontWeight = 'bold';
        modeDiv.style.color = '#0078d4';
        modeDiv.textContent = `検出: ${result.mode}`;
        resultsDiv.appendChild(modeDiv);
    }

    const errors = result.errors;

    if (!errors || errors.length === 0) {
        resultsDiv.innerHTML += '<span class="error">予期しないエラー</span>';
    } else if (errors.length === 1 && errors[0].startsWith('🚨')) {
        resultsDiv.innerHTML += `<span class="error">${errors[0]}</span>`;
    } else if (errors.length === 1 && errors[0].startsWith('✅')) {
        resultsDiv.innerHTML += `<span class="success">${errors[0]}</span>`;
    } else {
        resultsDiv.innerHTML += `<span class="error">${errors.length} 件の整合性エラーが見つかりました。</span><hr>`;
        const ul = document.createElement('ul');
        errors.forEach(msg => {
            const li = document.createElement('li');
            li.textContent = msg;
            ul.appendChild(li);
        });
        resultsDiv.appendChild(ul);
    }
}