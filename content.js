/**
 * content.js
 * ページ上の表（table）のデータをチェックするスクリプト
 */

console.log("[Info] Table Checker Start");

// ページ内のすべてのテーブル要素を取得
const tables = document.querySelectorAll('table');

if (tables.length === 0) {
    console.log("[Info] チェック対象のテーブルは見つかりませんでした。");
} else {
    tables.forEach((table, tableIndex) => {
        // テーブルの行（tr）を取得
        const rows = table.querySelectorAll('tr');
        console.log(`--- [Table ${tableIndex + 1}/${tables.length}] のチェック ---`);

        // ヘッダー行をスキップするために、ループを1から開始（行が存在する場合）
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            // 行内のすべてのセル（td, th）を取得
            const cells = row.querySelectorAll('td, th');
            
            // 必要な列（ここでは2列目と3列目）が存在するか確認
            if (cells.length >= 3) {
                // セルからテキストを取得し、数値に変換
                const col2Text = cells[1].textContent.trim();
                const col3Text = cells[2].textContent.trim();

                const value2 = parseFloat(col2Text);
                const value3 = parseFloat(col3Text);

                // 数値変換に成功し、かつカスタムルール（3列目 = 2列目 * 2）に反しているかチェック
                if (!isNaN(value2) && !isNaN(value3) && (value3 !== value2 * 2)) {
                    // 整合性エラー
                    console.error(`🚨 整合性エラー: テーブル ${tableIndex + 1}, 行 ${i} (DOM ID: ${row.id || 'N/A'})`);
                    console.error(`  - 2列目 (期待値の半分): ${value2}`);
                    console.error(`  - 3列目 (実際の値): ${value3}`);
                    console.error(`  - 期待される3列目の値: ${value2 * 2}`);
                    
                    // エラーを視覚的に強調する（任意）
                    row.style.border = '2px solid red';
                }
            } else {
                // 行に必要な列数が揃っていない場合の警告
                console.warn(`[Warn] テーブル ${tableIndex + 1}, 行 ${i} は列数が不足しています (${cells.length} 列)。スキップします。`);
            }
        }
//        console.log(`--- Table ${tableIndex + 1} のチェック終了 ---`);
    });

    console.log("[Info] Table Checker End");
}
