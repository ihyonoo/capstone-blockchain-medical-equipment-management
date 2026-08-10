import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { clampSidebarWidth } from '../../lib/sidebarResize';

// 접힌 사이드바는 접기 토글 버튼이 들어갈 만큼만 남기고 좁힌다.
const SIDEBAR_COLLAPSED_WIDTH = 32;

const DEFAULT_SIDEBAR_WIDTH = 480;

type ResizableSidebarProps = {
  /** 바깥 컨테이너의 data-testid. 페이지마다 다르게 준다. */
  testId: string;
  children: ReactNode;
};

/**
 * 페이지 좌측에 붙는 검색 패널 셸. 드래그 리사이즈·더블클릭 접기·sticky 배치를 담당하고,
 * 패널 안에 무엇이 들어가는지는 알지 않는다.
 */
export default function ResizableSidebar({ testId, children }: ResizableSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // 리사이즈: 핸들에서 mousedown 시점의 폭·커서 위치를 기준으로, 드래그 중에는 window 전역에서
  // mousemove를 듣는다(커서가 핸들을 벗어나도 계속 따라오게 하기 위함).
  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - resizeStartX.current;
      setWidth(clampSidebarWidth(resizeStartWidth.current + delta));
    };
    const handleMouseUp = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (event: React.MouseEvent) => {
    resizeStartX.current = event.clientX;
    resizeStartWidth.current = width;
    setIsResizing(true);
  };

  return (
    <div
      data-testid={testId}
      // 내용이 아무리 많아도 페이지 전체가 늘어나지 않도록, 사이드바 높이를 뷰포트(정확히는
      // 상단 바를 뺀 나머지)로 고정하고 넘치는 만큼은 패널 내부에서만 스크롤되게 한다.
      // 넓은 화면에서는 sticky로 상단바 바로 아래에 붙여, 오른쪽 본문을 스크롤해도 사이드바가
      // 따라 밀려 하단이 잘리지 않게 한다(좁은 화면은 위아래로 쌓이므로 제외).
      className="relative max-h-[calc(100vh-4.8rem-1px)] w-full max-w-full shrink-0 overflow-hidden xl:sticky xl:top-[calc(4.8rem+1px)] xl:h-[calc(100vh-4.8rem-1px)]"
      style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : width }}
    >
      {!collapsed ? (
        <section className="flex h-full flex-col fade-rise pr-3">
          {/* border-t-0 — 패널 위쪽이 상단 바 아래 테두리와 맞닿아 그 줄만 2px로 진해 보인다. */}
          <div className="surface-panel surface-panel--muted flex h-full min-h-0 flex-col border-t-0 p-5">
            {children}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        data-testid="sidebar-resize-handle"
        aria-label={collapsed ? '검색 패널 펼치기' : '검색 패널 크기 조절 — 더블클릭하면 접힙니다'}
        onMouseDown={collapsed ? undefined : handleResizeStart}
        onDoubleClick={() => setCollapsed((prev) => !prev)}
        onClick={collapsed ? () => setCollapsed(false) : undefined}
        className={`group absolute -right-1 top-0 z-10 flex h-full w-3 items-center justify-center border-0 bg-transparent p-0 ${
          collapsed ? 'cursor-pointer' : 'cursor-col-resize'
        }`}
      >
        <span className="h-full w-px bg-border transition-all group-hover:w-1 group-hover:bg-primary" />
      </button>

      {/* 핸들 더블클릭만으로는 접기를 발견할 수 없어, 경계선 세로 중앙에 눌러 보이는 버튼을 따로 둔다. */}
      {/* 컨테이너에 overflow-hidden이 걸려 있어 경계선 밖으로 내밀면 잘리므로 안쪽에 붙인다. */}
      {/* 핸들(z-10)과 겹치는 자리라 z-20으로 올린다. */}
      {/* 접힌 핸들도 '펼치기' 라벨을 갖고 있어, 접근성 이름이 겹치지 않게 '열기'로 구분한다. */}
      <button
        type="button"
        data-testid="sidebar-collapse-toggle"
        aria-label={collapsed ? '검색 패널 열기' : '검색 패널 접기'}
        onClick={() => setCollapsed((prev) => !prev)}
        className="absolute right-0 top-1/2 z-20 flex h-8 w-4 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-border bg-card p-0 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        {collapsed ? <ChevronsRight className="h-3 w-3" /> : <ChevronsLeft className="h-3 w-3" />}
      </button>
    </div>
  );
}
