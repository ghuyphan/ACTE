const pluginModule = jest.requireActual('../plugins/withExpoWidgetsBundleFix.js') as {
  __internal: {
    ensureBundleCopyPhase: (project: ReturnType<typeof createMockProject>, projectRoot: string) => boolean;
  };
};

const { ensureBundleCopyPhase } = pluginModule.__internal;

type NativeTarget = {
  name: string;
  productName: string;
  buildPhases: Array<{ value: string; comment?: string }>;
};

function ref(value: string, comment?: string) {
  return comment ? { value, comment } : { value };
}

function createMockProject() {
  let nextId = 1;
  const nativeTargets: Record<string, NativeTarget> = {
    WIDGET: {
      name: '"ExpoWidgetsTarget"',
      productName: '"ExpoWidgetsTarget"',
      buildPhases: [],
    },
  };
  const project = {
    hash: {
      project: {
        objects: {
          PBXNativeTarget: nativeTargets,
          PBXShellScriptBuildPhase: {} as Record<string, { name: string; shellScript: string }>,
        },
      },
    },
    pbxNativeTargetSection() {
      return this.hash.project.objects.PBXNativeTarget;
    },
    addBuildPhase(
      _files: unknown[],
      _type: string,
      name: string,
      targetKey: string,
      options: { shellScript: string }
    ) {
      const uuid = `PHASE_${nextId}`;
      nextId += 1;
      this.hash.project.objects.PBXShellScriptBuildPhase[uuid] = {
        name: `"${name}"`,
        shellScript: options.shellScript,
      };
      this.hash.project.objects.PBXNativeTarget[targetKey].buildPhases.push(ref(uuid, name));
    },
  };

  return project;
}

describe('withExpoWidgetsBundleFix', () => {
  it('adds a widget bundle copy phase that fails Release builds when the JS bundle is missing', () => {
    const project = createMockProject();

    expect(ensureBundleCopyPhase(project, '/repo')).toBe(true);

    const phaseRef = project.hash.project.objects.PBXNativeTarget.WIDGET.buildPhases[0];
    const phase = project.hash.project.objects.PBXShellScriptBuildPhase[phaseRef?.value ?? ''];

    expect(phase.name).toBe('"Copy ExpoWidgets JS Bundle"');
    expect(phase.shellScript).toContain('node_modules/expo-widgets/bundle/build/ExpoWidgets.bundle');
    expect(phase.shellScript).toContain('if [ "$CONFIGURATION" = "Release" ]; then');
    expect(phase.shellScript).toContain('exit 1');
  });

  it('does not duplicate the widget bundle copy phase', () => {
    const project = createMockProject();

    expect(ensureBundleCopyPhase(project, '/repo')).toBe(true);
    expect(ensureBundleCopyPhase(project, '/repo')).toBe(true);

    expect(project.hash.project.objects.PBXNativeTarget.WIDGET.buildPhases).toHaveLength(1);
  });

  it('upgrades an existing widget bundle copy phase that only warns in Release', () => {
    const project = createMockProject();
    project.hash.project.objects.PBXShellScriptBuildPhase.PHASE_1 = {
      name: '"Copy ExpoWidgets JS Bundle"',
      shellScript: 'echo "warning: ExpoWidgets JS bundle source not found"',
    };
    project.hash.project.objects.PBXNativeTarget.WIDGET.buildPhases.push(
      ref('PHASE_1', 'Copy ExpoWidgets JS Bundle')
    );

    expect(ensureBundleCopyPhase(project, '/repo')).toBe(true);

    const phase = project.hash.project.objects.PBXShellScriptBuildPhase.PHASE_1;
    expect(project.hash.project.objects.PBXNativeTarget.WIDGET.buildPhases).toHaveLength(1);
    expect(phase.shellScript).toContain('if [ "$CONFIGURATION" = "Release" ]; then');
    expect(phase.shellScript).toContain('exit 1');
  });

  it('reports when the ExpoWidgetsTarget is absent', () => {
    const project = createMockProject();
    project.hash.project.objects.PBXNativeTarget = {};

    expect(ensureBundleCopyPhase(project, '/repo')).toBe(false);
  });
});
