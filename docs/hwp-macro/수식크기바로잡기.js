// ═══════════════════════════════════════════════════════════════════════════
// Mathory — 수식 크기 바로잡기 (한글 2022 스크립트 매크로)
//
// 왜: Mathory가 내보낸 .hwpx를 한글 2022(12.0.0.4426)는 열 때 수식 크기를 다시 재지 않는다.
//     Mathory는 한글 규칙 모델(lib/export/hwpx/hwpLayout.ts)로 크기를 미리 계산해 넣지만 오차가 남는다.
//     수식 편집기에 들어갔다 나오면 한글이 정확히 다시 잰다 — 이 매크로가 문서의 모든 수식에 그 일을 한 번에 한다
//     (글자 크기를 한 단계 바꿨다 되돌린다).
//
// ⚠ 한글은 매크로 이름이 X면 함수 `OnScriptMacro_X`를 부른다(2026-10-15 실물: 이름 "수식출입"으로 등록하자
//   "OnScriptMacro_수식출입 … Function 개체가 아닙니다"). 그래서 아래에 이름 둘을 걸어 두었다 —
//   다른 이름으로 등록했다면 맨 아래 연결 함수를 하나 더 만들어 그 이름으로 바꾸면 된다.
//
// 쓰는 법(한 번만 등록):
//   1. 한글 2022 → [도구] → [매크로] → [스크립트 매크로]에서 새 매크로(이름: 수식출입 또는 수식크기바로잡기)
//   2. 이 파일 전체를 붙여 넣어 저장
//   3. Mathory에서 받은 .hwpx를 열 때마다 그 매크로를 실행(단축키를 붙여 두면 편하다)
//
// 확인됨(2026-10-15 덕수 실물): 한 번 실행으로 본문·글상자·표·미주 안의 수식까지 전부 바로잡는다.
// ═══════════════════════════════════════════════════════════════════════════

function Mathory_수식크기바로잡기()
{
    var ctrl;
    try {
        ctrl = HeadCtrl;
    } catch (e) {
        Mathory_알림("HeadCtrl을 읽지 못했습니다 — 이 한글 판의 스크립트 매크로가 문서 개체를 내주지 않습니다.\n" + e.message);
        return;
    }
    var count = 0;
    var failed = 0;
    while (ctrl != null) {
        if (ctrl.CtrlID == "eqed") {
            try {
                var set = ctrl.Properties;
                var unit = set.Item("BaseUnit");
                // 크기를 바꿨다 되돌리면 한글이 수식을 다시 조판하며 상자 크기·기준선을 새로 잰다
                set.SetItem("BaseUnit", unit + 100);
                ctrl.Properties = set;
                set.SetItem("BaseUnit", unit);
                ctrl.Properties = set;
                count++;
            } catch (e) {
                failed++;
            }
        }
        ctrl = ctrl.Next;
    }
    Mathory_알림("수식 " + count + "개의 크기를 바로잡았습니다." + (failed ? "\n(실패 " + failed + "개)" : ""));
}

// 결과 안내 — 2026-10-15 실물: 한글 2022 스크립트 매크로에는 MessageBox가 없다(예외 → 조용히 지나갔다).
// 그래서 차례로: ① MessageBox(있는 판) ② 윈도우 알림창(WScript.Shell Popup — 5초 뒤 저절로 닫힘) ③ 조용히.
function Mathory_알림(text)
{
    try {
        MessageBox(text);
        return;
    } catch (e) { /* 다음 방법 */ }
    try {
        var shell = new ActiveXObject("WScript.Shell");
        shell.Popup(text, 5, "Mathory — 수식 크기 바로잡기", 64);
        return;
    } catch (e) { /* 다음 방법 */ }
}

// ── 매크로 이름 연결: 등록한 이름에 맞는 것이 불린다 ──
function OnScriptMacro_수식출입() { Mathory_수식크기바로잡기(); }
function OnScriptMacro_수식크기바로잡기() { Mathory_수식크기바로잡기(); }
