import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const pluginModule = jest.requireActual('../plugins/withCustomWidgetSwift.js') as {
  __internal: {
    copyWidgetLocalizationResources: (
      project: ReturnType<typeof createMockProject>,
      projectRoot: string,
      iosRoot: string,
      targetKey: string
    ) => number;
    getWidgetDisplayName: (config: {
      name?: string;
      plugins?: Array<string | [string, { widgets?: Array<Record<string, unknown>> }]>;
    }) => string;
  };
};

const { copyWidgetLocalizationResources, getWidgetDisplayName } = pluginModule.__internal;
type ProjectRef = ReturnType<typeof ref>;
type PbxGroupEntry = {
  name?: string;
  children: ProjectRef[];
};
type PbxVariantGroupEntry = {
  name: string;
  children: ProjectRef[];
};
type PbxFileReferenceEntry = {
  path: string;
  name: string;
};
type PbxBuildFileEntry = {
  fileRef: string;
  fileRef_comment: string;
};

function ref(value: string, comment?: string) {
  return comment ? { value, comment } : { value };
}

function normalize(value: string | undefined) {
  return typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : '';
}

function createMockProject() {
  let nextId = 1;
  const project = {
    getFirstProject: () => ({ uuid: 'PROJECT' }),
    hash: {
      project: {
        objects: {
          PBXProject: {
            PROJECT: {
              knownRegions: [],
            },
          },
          PBXGroup: {
            MAIN_GROUP: {
              children: [ref('WIDGET_GROUP', 'ExpoWidgetsTarget'), ref('RESOURCES_GROUP', 'Resources')],
            },
            WIDGET_GROUP: {
              name: '"ExpoWidgetsTarget"',
              children: [] as ProjectRef[],
            },
            RESOURCES_GROUP: {
              name: '"Resources"',
              children: [] as ProjectRef[],
            },
          } as Record<string, PbxGroupEntry>,
          PBXVariantGroup: {} as Record<string, PbxVariantGroupEntry | string>,
          PBXFileReference: {} as Record<string, PbxFileReferenceEntry | string>,
          PBXBuildFile: {} as Record<string, PbxBuildFileEntry | string>,
          PBXResourcesBuildPhase: {
            WIDGET_RESOURCES: {
              files: [] as ProjectRef[],
            },
            WIDGET_RESOURCES_comment: 'Resources',
          },
        },
      },
    },
    findPBXGroupKey(criteria: { name?: string }) {
      const groups = this.hash.project.objects.PBXGroup;
      for (const [key, group] of Object.entries(groups)) {
        if (key.endsWith('_comment')) {
          continue;
        }

        if (normalize((group as { name?: string }).name) === criteria.name) {
          return key;
        }
      }

      return null;
    },
    generateUuid() {
      const uuid = `UUID_${nextId}`;
      nextId += 1;
      return uuid;
    },
    pbxCreateVariantGroup(name: string) {
      const key = this.generateUuid();
      this.hash.project.objects.PBXVariantGroup[key] = {
        name,
        children: [],
      };
      this.hash.project.objects.PBXVariantGroup[`${key}_comment`] = name;
      return key;
    },
    getPBXGroupByKey(key: string) {
      return this.hash.project.objects.PBXGroup[key];
    },
    getPBXVariantGroupByKey(key: string) {
      return this.hash.project.objects.PBXVariantGroup[key];
    },
    addToPbxGroup(fileOrKey: string | { fileRef: string; basename: string }, groupKey: string) {
      const group = this.hash.project.objects.PBXGroup[groupKey];
      if (typeof fileOrKey === 'string') {
        const variantGroup = this.hash.project.objects.PBXVariantGroup[fileOrKey] as PbxVariantGroupEntry | undefined;
        group.children.push(ref(fileOrKey, normalize(variantGroup?.name)));
        return;
      }

      group.children.push(ref(fileOrKey.fileRef, fileOrKey.basename));
    },
    pbxResourcesBuildPhaseObj(targetKey: string) {
      return targetKey === 'TARGET' ? this.hash.project.objects.PBXResourcesBuildPhase.WIDGET_RESOURCES : null;
    },
    addToPbxBuildFileSection(file: { uuid: string; fileRef: string; basename: string; group: string }) {
      this.hash.project.objects.PBXBuildFile[file.uuid] = {
        fileRef: file.fileRef,
        fileRef_comment: file.basename,
      };
      this.hash.project.objects.PBXBuildFile[`${file.uuid}_comment`] = `${file.basename} in ${file.group}`;
    },
    addToPbxResourcesBuildPhase(file: { uuid: string; basename: string; group: string }) {
      this.hash.project.objects.PBXResourcesBuildPhase.WIDGET_RESOURCES.files.push(
        ref(file.uuid, `${file.basename} in ${file.group}`)
      );
    },
    addKnownRegion(region: string) {
      const knownRegions = this.hash.project.objects.PBXProject.PROJECT.knownRegions as string[];
      if (!knownRegions.includes(region)) {
        knownRegions.push(region);
      }
    },
    addResourceFile(filePath: string, options: { variantGroup?: boolean }, groupKey: string) {
      const fileRef = this.generateUuid();
      this.hash.project.objects.PBXFileReference[fileRef] = {
        path: `"${filePath}"`,
        name: '"Localizable.strings"',
      };
      this.hash.project.objects.PBXFileReference[`${fileRef}_comment`] = 'Localizable.strings';

      if (options.variantGroup) {
        (
          this.hash.project.objects.PBXVariantGroup[groupKey] as PbxVariantGroupEntry
        ).children.push(ref(fileRef, 'Localizable.strings'));
      }
    },
  };

  return project;
}

describe('withCustomWidgetSwift', () => {
  let tempRoot: string | null = null;

  afterEach(() => {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it('prefers the widget displayName from the expo-widgets config', () => {
    expect(
      getWidgetDisplayName({
        name: 'Noto',
        plugins: [
          [
            'expo-widgets',
            {
              widgets: [
                {
                  name: 'LocketWidget',
                  targetName: 'ExpoWidgetsTarget',
                  displayName: 'Memories',
                },
              ],
            },
          ],
        ],
      })
    ).toBe('Memories');
  });

  it('falls back to the app name when the widget config omits a displayName', () => {
    expect(
      getWidgetDisplayName({
        name: 'Noto',
        plugins: [
          [
            'expo-widgets',
            {
              widgets: [
                {
                  name: 'LocketWidget',
                  targetName: 'ExpoWidgetsTarget',
                },
              ],
            },
          ],
        ],
      })
    ).toBe('Noto');
  });

  it('copies widget localizations into a variant group without duplicating bundle entries', () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'with-custom-widget-swift-'));

    const projectRoot = path.join(tempRoot, 'project');
    const iosRoot = path.join(tempRoot, 'ios');
    const enSourceDirectory = path.join(projectRoot, 'widgets', 'ios', 'en.lproj');
    const viSourceDirectory = path.join(projectRoot, 'widgets', 'ios', 'vi.lproj');

    fs.mkdirSync(enSourceDirectory, { recursive: true });
    fs.mkdirSync(viSourceDirectory, { recursive: true });
    fs.mkdirSync(iosRoot, { recursive: true });
    fs.writeFileSync(path.join(enSourceDirectory, 'Localizable.strings'), '"widget.title" = "Memories";\n');
    fs.writeFileSync(path.join(viSourceDirectory, 'Localizable.strings'), '"widget.title" = "Ky niem";\n');

    const project = createMockProject();

    expect(copyWidgetLocalizationResources(project, projectRoot, iosRoot, 'TARGET')).toBe(2);
    expect(copyWidgetLocalizationResources(project, projectRoot, iosRoot, 'TARGET')).toBe(2);

    expect(fs.existsSync(path.join(iosRoot, 'ExpoWidgetsTarget', 'en.lproj', 'Localizable.strings'))).toBe(true);
    expect(fs.existsSync(path.join(iosRoot, 'ExpoWidgetsTarget', 'vi.lproj', 'Localizable.strings'))).toBe(true);

    expect(project.hash.project.objects.PBXProject.PROJECT.knownRegions).toEqual(['en', 'vi']);

    const variantGroupKeys = Object.keys(project.hash.project.objects.PBXVariantGroup).filter(
      (key) => !key.endsWith('_comment')
    );
    expect(variantGroupKeys).toHaveLength(1);

    const variantGroupKey = variantGroupKeys[0];
    expect(project.hash.project.objects.PBXGroup.WIDGET_GROUP.children).toEqual([
      ref(variantGroupKey, 'Localizable.strings'),
    ]);
    expect(
      (project.hash.project.objects.PBXVariantGroup[variantGroupKey] as PbxVariantGroupEntry).children
    ).toHaveLength(2);
    expect(project.hash.project.objects.PBXResourcesBuildPhase.WIDGET_RESOURCES.files).toEqual([
      ref('UUID_2', 'Localizable.strings in Resources'),
    ]);
    expect(project.hash.project.objects.PBXBuildFile.UUID_2).toEqual({
      fileRef: variantGroupKey,
      fileRef_comment: 'Localizable.strings',
    });
  });
});
