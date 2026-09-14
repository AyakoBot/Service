import assert from 'node:assert';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const pluginsDir = join(process.cwd(), 'src', 'Plugins');

interface Marker {
 plugin: string;
 field: string;
 partner: string;
}

const pluginDirs = (): string[] =>
 existsSync(pluginsDir)
  ? readdirSync(pluginsDir, { withFileTypes: true })
     .filter((entry) => entry.isDirectory())
     .map((entry) => entry.name)
  : [];

const collectMarkers = (): Marker[] => {
 const markers: Marker[] = [];

 pluginDirs().forEach((plugin) => {
  const fragment = join(pluginsDir, plugin, 'schema.prisma');
  if (!existsSync(fragment)) return;

  readFileSync(fragment, 'utf8')
   .split('\n')
   .forEach((line) => {
    const match = /^\s*([A-Za-z0-9_]+)\s.*\/\/\s*@crossplugin\(([a-z-]+)\)/.exec(line);
    if (match) markers.push({ plugin, field: match[1]!, partner: match[2]! });
   });
 });

 return markers;
};

const sourcesOf = (plugin: string): string => {
 const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
   const full = join(dir, entry.name);
   if (entry.isDirectory()) return walk(full);

   return entry.name.endsWith('.ts') && !entry.name.includes('.test.') ? [full] : [];
  });

 const root = join(pluginsDir, plugin);

 return existsSync(root)
  ? walk(root)
     .map((file) => readFileSync(file, 'utf8'))
     .join('\n')
  : '';
};

const bySettingName = (): Map<string, string> => {
 const names = new Map<string, string>();

 pluginDirs().forEach((plugin) => {
  const match = /settingName = PluginName\.([A-Za-z0-9_]+)/.exec(sourcesOf(plugin));
  if (match) names.set(match[1]!.toLowerCase(), plugin);
 });

 return names;
};

const resolvePartner = (partner: string, names: Map<string, string>): string =>
 names.get(partner.replace(/-/g, '')) ?? partner;

test('every @crossplugin marker names a plugin that exists', () => {
 const names = bySettingName();

 collectMarkers().forEach((marker) => {
  const resolved = resolvePartner(marker.partner, names);

  assert.ok(
   existsSync(join(pluginsDir, resolved)),
   `${marker.plugin}/schema.prisma marks '${marker.field}' as read by '${marker.partner}', but no such plugin exists`,
  );
 });
});

test('every @crossplugin marker points at code that references the column', () => {
 const names = bySettingName();

 collectMarkers().forEach((marker) => {
  const resolved = resolvePartner(marker.partner, names);
  const referenced =
   sourcesOf(resolved).includes(marker.field) || sourcesOf(marker.plugin).includes(marker.field);

  assert.ok(
   referenced,
   `${marker.plugin}/schema.prisma marks '${marker.field}' as read by '${marker.partner}', but neither plugin references that name; the marker has gone stale`,
  );
 });
});

test('markers sit on fields, never on a model or enum declaration', () => {
 collectMarkers().forEach((marker) => {
  assert.ok(
   !['model', 'enum'].includes(marker.field),
   `a @crossplugin marker in ${marker.plugin}/schema.prisma sits on a '${marker.field}' declaration; it belongs on a field`,
  );
 });
});

test('economy customRoleReward is marked and points at customRoles', () => {
 const found = collectMarkers().find(
  (marker) => marker.plugin === 'economy' && marker.field === 'customRoleReward',
 );

 assert.ok(found, 'economy/schema.prisma should mark customRoleReward with @crossplugin');
 assert.strictEqual(found?.partner, 'custom-roles');
});
