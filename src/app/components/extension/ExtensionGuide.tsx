export function ExtensionGuide() {
  return <div className="text-sm leading-7 text-gray-700">
    <p>생성한 글을 확장 프로그램에 전달하고 네이버 에디터에 입력합니다.</p>
    <a href="/blog-auto-write-extension-v1.0.0.zip" download className="my-4 block rounded-xl bg-[#03c75a] p-3 text-center font-bold text-white">확장 프로그램 다운로드 (.zip)</a>
    <ol className="list-decimal pl-5 space-y-2">
      <li>ZIP 압축을 해제하고 Chrome의 <code>chrome://extensions</code>를 엽니다.</li>
      <li>개발자 모드를 켜고 ‘압축해제된 확장 프로그램을 로드합니다’에서 압축 해제한 폴더를 선택합니다.</li>
      <li>확장 팝업에 현재 대시보드 주소(로컬 또는 배포 주소)를 등록하고 대시보드를 새로고침합니다.</li>
      <li>대시보드에 로그인하여 글을 생성한 뒤 ‘확장 프로그램으로 전달’을 누릅니다.</li>
      <li>네이버에 직접 로그인하고 글쓰기 화면을 연 뒤 확장 팝업에서 입력을 시작합니다.</li>
    </ol>
    <p className="mt-4 text-xs">Chrome은 실제 붙여넣기·이미지 첨부에 필요한 디버깅 권한 안내를 표시합니다. 기존 글에 재시도하면 중복 삽입될 수 있으니 내용을 먼저 확인해 주세요.</p>
    <p className="mt-3 text-xs">AI Key와 웹 로그인 토큰은 확장 프로그램에 전달하지 않습니다. 입력 후 네이버 임시저장·재열기로 내용과 서식을 확인하고 직접 발행해 주세요.</p>
  </div>;
}
