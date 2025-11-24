import * as CT from '../../../../Typings/Typings.js';
import DataBase from '../../../DataBase.js';

export default <T extends keyof typeof CT.SettingsName2TableName>(
 tableName: T,
 fieldName: string,
 guildid: string,
 newSetting: unknown,
 uniquetimestamp: number | undefined,
): CT.CRUDResult<T> => {
 const where = uniquetimestamp
  ? { where: { uniquetimestamp }, data: { [fieldName]: newSetting } }
  : { where: { guildid }, data: { [fieldName]: newSetting } };

 return (
  DataBase[CT.SettingsName2TableName[tableName] as keyof typeof DataBase] as never as {
   update: (x: typeof where) => CT.CRUDResult<T>;
  }
 ).update(where);
};
