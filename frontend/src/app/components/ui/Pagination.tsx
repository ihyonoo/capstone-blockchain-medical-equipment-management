import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { buildPageList, getTotalPages, PAGE_SIZE_OPTIONS } from '../../lib/pagination';
import { cn } from './utils';

type PaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

/** 목록 하단 페이저. 페이지당 개수 선택과 페이지 이동을 함께 담당한다. */
export default function Pagination({ page, pageSize, totalItems, onPageChange, onPageSizeChange }: PaginationProps) {
  const totalPages = getTotalPages(totalItems, pageSize);
  const firstIndex = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastIndex = Math.min(totalItems, page * pageSize);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
      <div className="flex items-center gap-3">
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger aria-label="페이지당 개수" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}개씩
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {totalItems}건 중 {firstIndex}–{lastIndex}건
        </span>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            aria-label="이전 페이지"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="app-nav-tab disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {buildPageList(page, totalPages).map((item, index) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-label={`${item}페이지`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPageChange(item)}
                className={cn('app-nav-tab', item === page && 'app-nav-tab--active')}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            aria-label="다음 페이지"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="app-nav-tab disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
