import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const pluginModule = jest.requireActual('../plugins/withCustomAndroidWidget.js') as {
  __internal: {
    assertWidgetSourceFiles: (projectRoot: string) => void;
    getMissingWidgetSourcePaths: (projectRoot: string) => string[];
    SOURCE_MAPPINGS: Array<[string, string]>;
  };
};

const { assertWidgetSourceFiles, getMissingWidgetSourcePaths, SOURCE_MAPPINGS } =
  pluginModule.__internal;

describe('withCustomAndroidWidget', () => {
  let tempRoot: string | null = null;

  afterEach(() => {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  function createProjectRootWithSources(missingSourcePath?: string) {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'with-custom-android-widget-'));
    const projectRoot = path.join(tempRoot, 'project');

    for (const [sourceRelativePath] of SOURCE_MAPPINGS) {
      if (sourceRelativePath === missingSourcePath) {
        continue;
      }

      const sourcePath = path.join(projectRoot, sourceRelativePath);
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.writeFileSync(sourcePath, 'source\n');
    }

    return projectRoot;
  }

  it('fails prebuild when a required Android widget source file is missing', () => {
    const projectRoot = createProjectRootWithSources('widgets/android/NotoWidgetProvider.kt');

    expect(getMissingWidgetSourcePaths(projectRoot)).toEqual(['widgets/android/NotoWidgetProvider.kt']);
    expect(() => assertWidgetSourceFiles(projectRoot)).toThrow(
      /Required Android widget source files are missing: widgets\/android\/NotoWidgetProvider\.kt/
    );
  });

  it('accepts the complete Android widget source set used by prebuild', () => {
    const projectRoot = createProjectRootWithSources();

    expect(getMissingWidgetSourcePaths(projectRoot)).toEqual([]);
    expect(() => assertWidgetSourceFiles(projectRoot)).not.toThrow();
  });

  it('keeps the checked-in Android widget source set complete', () => {
    const projectRoot = path.join(__dirname, '..');

    expect(getMissingWidgetSourcePaths(projectRoot)).toEqual([]);
  });
});
