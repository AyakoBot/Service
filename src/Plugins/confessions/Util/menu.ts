export enum MenuPath {
 Delete = 'delete',
 Moderate = 'moderate',
 Report = 'report',
}

export const menuPath = (author: boolean, reviewer: boolean): MenuPath => {
 if (author) return MenuPath.Delete;

 return reviewer ? MenuPath.Moderate : MenuPath.Report;
};
