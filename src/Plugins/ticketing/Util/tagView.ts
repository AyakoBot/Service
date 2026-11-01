import { PageDirection, ToolkitMode } from '../Classes/Enums.js';

export const queryLimit = 40;

export interface ToolkitView {
 page: number;
 manage: boolean;
 query: string;
}

export const viewArgs = (view: ToolkitView) => [
 view.page,
 view.manage ? ToolkitMode.Manage : ToolkitMode.Browse,
 view.query.slice(0, queryLimit),
];

export const readView = ([page, mode, ...query]: string[]): ToolkitView => ({
 page: Number(page) || 0,
 manage: mode === ToolkitMode.Manage,
 query: query.join('_'),
});

export const pageArgs = (direction: PageDirection, view: ToolkitView) => [
 direction,
 ...viewArgs(view),
];

export const readPageArgs = ([direction, ...rest]: string[]): ToolkitView => {
 const view = readView(rest);
 return { ...view, page: direction === PageDirection.Next ? view.page + 1 : view.page - 1 };
};
