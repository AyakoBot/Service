export const nodePageSize = 23;

export enum NodePageNav {
 Previous = 'page:previous',
 Next = 'page:next',
}

export const lastNodePage = (count: number): number =>
 Math.max(0, Math.ceil(count / nodePageSize) - 1);

export const shownNodePage = (
 entries: { path: string }[],
 selectedPath: string | null,
 requested: number,
): number => {
 const selected = selectedPath ? entries.findIndex((entry) => entry.path === selectedPath) : -1;
 if (selected >= 0) return Math.floor(selected / nodePageSize);

 return Math.min(Math.max(requested, 0), lastNodePage(entries.length));
};

export const stepNodePage = (page: number, nav: NodePageNav): number =>
 nav === NodePageNav.Previous ? page - 1 : page + 1;
