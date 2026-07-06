import type Client from '../Classes/Client.js';

const resolvePluginDependencies = function (
 this: Client,
 root: Client['plugins'][number],
): Client['plugins'] {
 const byName = new Map(this.plugins.map((plugin) => [plugin.settingName, plugin]));
 const resolved: Client['plugins'] = [];
 const visited = new Set<string>();
 const queue: Client['plugins'] = [root];

 while (queue.length) {
  const plugin = queue.shift()!;
  if (visited.has(plugin.settingName)) continue;
  visited.add(plugin.settingName);
  resolved.push(plugin);

  plugin.dependencies.forEach((dependency) => {
   const dependencyPlugin = byName.get(dependency);
   if (!dependencyPlugin) {
    throw new Error(
     `Plugin "${plugin.settingName}" declares unknown dependency "${dependency}"`,
    );
   }
   queue.push(dependencyPlugin);
  });
 }

 return resolved;
};

export default resolvePluginDependencies;
