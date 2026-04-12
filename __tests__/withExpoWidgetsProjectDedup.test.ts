const pluginModule = jest.requireActual('../plugins/withExpoWidgetsProjectDedup.js') as {
  __internal: {
    dedupeExpoWidgetsProject: (project: ReturnType<typeof createMockProject>) => {
      changed: boolean;
      removedWidgetTargets: number;
    };
  };
};

const { dedupeExpoWidgetsProject } = pluginModule.__internal;

function ref(value: string, comment?: string) {
  return comment ? { value, comment } : { value };
}

function createMockProject() {
  return {
    getFirstProject: () => ({ uuid: 'PROJECT' }),
    hash: {
      project: {
        objects: {
          PBXProject: {
            PROJECT: {
              targets: [
                ref('APP', 'Noto'),
                ref('WIDGET_1', 'ExpoWidgetsTarget'),
                ref('WIDGET_2', 'ExpoWidgetsTarget'),
              ],
              attributes: {
                TargetAttributes: {
                  APP: {},
                  WIDGET_1: {},
                  WIDGET_2: {},
                },
              },
              mainGroup: ref('MAIN_GROUP', 'Main Group'),
            },
          },
          PBXNativeTarget: {
            APP: {
              name: '"Noto"',
              productType: 'com.apple.product-type.application',
              dependencies: [ref('DEP_WIDGET_1'), ref('DEP_WIDGET_2')],
              buildPhases: [ref('EMBED_EMPTY'), ref('EMBED_FILLED')],
            },
            WIDGET_1: {
              name: '"ExpoWidgetsTarget"',
              productReference: ref('PRODUCT_WIDGET_1', 'ExpoWidgetsTarget.appex'),
            },
            WIDGET_2: {
              name: '"ExpoWidgetsTarget"',
              productReference: ref('PRODUCT_WIDGET_2', 'ExpoWidgetsTarget.appex'),
            },
          },
          PBXGroup: {
            MAIN_GROUP: {
              children: [
                ref('WIDGET_GROUP_1', 'ExpoWidgetsTarget'),
                ref('WIDGET_GROUP_2', 'ExpoWidgetsTarget'),
                ref('PRODUCTS_GROUP', 'Products'),
              ],
            },
            WIDGET_GROUP_1: {
              name: '"ExpoWidgetsTarget"',
              children: [
                ref('SOURCE_1', 'LocketWidget.swift'),
                ref('SOURCE_2', 'LocketWidget.swift'),
              ],
            },
            WIDGET_GROUP_2: {
              name: '"ExpoWidgetsTarget"',
              children: [],
            },
            PRODUCTS_GROUP: {
              name: '"Products"',
              children: [
                ref('PRODUCT_WIDGET_1', 'ExpoWidgetsTarget.appex'),
                ref('PRODUCT_WIDGET_2', 'ExpoWidgetsTarget.appex'),
              ],
            },
          },
          PBXCopyFilesBuildPhase: {
            EMBED_EMPTY: {
              name: '"Embed Foundation Extensions"',
              files: [],
            },
            EMBED_FILLED: {
              name: '"Embed Foundation Extensions"',
              files: [
                ref('BUILD_FILE_1', 'ExpoWidgetsTarget.appex in Embed Foundation Extensions'),
                ref('BUILD_FILE_2', 'ExpoWidgetsTarget.appex in Embed Foundation Extensions'),
              ],
            },
          },
          PBXBuildFile: {
            BUILD_FILE_1: {
              fileRef: ref('PRODUCT_WIDGET_1', 'ExpoWidgetsTarget.appex'),
            },
            BUILD_FILE_2: {
              fileRef: ref('PRODUCT_WIDGET_2', 'ExpoWidgetsTarget.appex'),
            },
          },
          PBXTargetDependency: {
            DEP_WIDGET_1: {
              target: 'WIDGET_1',
            },
            DEP_WIDGET_2: {
              target: 'WIDGET_2',
            },
          },
        },
      },
    },
  };
}

describe('withExpoWidgetsProjectDedup', () => {
  it('removes duplicate ExpoWidgetsTarget references while keeping the first live target', () => {
    const project = createMockProject();

    const result = dedupeExpoWidgetsProject(project);
    const objects = project.hash.project.objects;

    expect(result).toEqual({
      changed: true,
      removedWidgetTargets: 1,
    });

    expect(objects.PBXProject.PROJECT.targets).toEqual([
      ref('APP', 'Noto'),
      ref('WIDGET_1', 'ExpoWidgetsTarget'),
    ]);
    expect(objects.PBXProject.PROJECT.attributes.TargetAttributes).toEqual({
      APP: {},
      WIDGET_1: {},
    });
    expect(objects.PBXGroup.MAIN_GROUP.children).toEqual([
      ref('WIDGET_GROUP_1', 'ExpoWidgetsTarget'),
      ref('PRODUCTS_GROUP', 'Products'),
    ]);
    expect(objects.PBXGroup.WIDGET_GROUP_1.children).toEqual([
      ref('SOURCE_1', 'LocketWidget.swift'),
    ]);
    expect(objects.PBXGroup.PRODUCTS_GROUP.children).toEqual([
      ref('PRODUCT_WIDGET_1', 'ExpoWidgetsTarget.appex'),
    ]);
    expect(objects.PBXNativeTarget.APP.dependencies).toEqual([ref('DEP_WIDGET_1')]);
    expect(objects.PBXNativeTarget.APP.buildPhases).toEqual([ref('EMBED_FILLED')]);
    expect(objects.PBXCopyFilesBuildPhase.EMBED_FILLED.files).toEqual([
      ref('BUILD_FILE_1', 'ExpoWidgetsTarget.appex in Embed Foundation Extensions'),
    ]);
  });

  it('is a no-op when there is only one ExpoWidgetsTarget entry', () => {
    const project = createMockProject();
    project.hash.project.objects.PBXProject.PROJECT.targets = [
      ref('APP', 'Noto'),
      ref('WIDGET_1', 'ExpoWidgetsTarget'),
    ];

    const result = dedupeExpoWidgetsProject(project);

    expect(result).toEqual({
      changed: false,
      removedWidgetTargets: 0,
    });
  });
});
