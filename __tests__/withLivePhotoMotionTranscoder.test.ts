import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const pluginModule = jest.requireActual('../plugins/withLivePhotoMotionTranscoder.js') as {
  __internal: {
    copyLivePhotoSourceFiles: (
      projectRoot: string,
      iosRoot: string,
      appName: string,
      shouldFailFast: boolean
    ) => number;
    SOURCE_FILES: string[];
  };
};

const { copyLivePhotoSourceFiles, SOURCE_FILES } = pluginModule.__internal;

describe('withLivePhotoMotionTranscoder', () => {
  let tempRoot: string | null = null;

  afterEach(() => {
    jest.restoreAllMocks();
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  function createRoots(sourceFiles: string[]) {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'with-live-photo-motion-transcoder-'));
    const projectRoot = path.join(tempRoot, 'project');
    const iosRoot = path.join(tempRoot, 'ios');

    fs.mkdirSync(path.join(projectRoot, 'native', 'ios'), { recursive: true });
    fs.mkdirSync(iosRoot, { recursive: true });

    for (const filename of sourceFiles) {
      fs.writeFileSync(path.join(projectRoot, 'native', 'ios', filename), `${filename}\n`);
    }

    return { iosRoot, projectRoot };
  }

  it('copies the checked-in iOS live-photo bridge sources into the generated project', () => {
    const { iosRoot, projectRoot } = createRoots(SOURCE_FILES);

    expect(copyLivePhotoSourceFiles(projectRoot, iosRoot, 'Noto', true)).toBe(SOURCE_FILES.length);

    for (const filename of SOURCE_FILES) {
      expect(fs.existsSync(path.join(iosRoot, 'Noto', filename))).toBe(true);
    }
  });

  it('keeps the checked-in iOS live-photo bridge source set complete', () => {
    const projectRoot = path.join(__dirname, '..');

    for (const filename of SOURCE_FILES) {
      expect(fs.existsSync(path.join(projectRoot, 'native', 'ios', filename))).toBe(true);
    }
  });

  it('fails fast for release/prebuild verification when a native source file is missing', () => {
    const [firstSource] = SOURCE_FILES;
    const { iosRoot, projectRoot } = createRoots(firstSource ? [firstSource] : []);

    expect(() => copyLivePhotoSourceFiles(projectRoot, iosRoot, 'Noto', true)).toThrow(
      /\[withLivePhotoMotionTranscoder\] Source file not found:/
    );
  });

  it('keeps local prebuild lenient while warning about missing native source files', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const [firstSource] = SOURCE_FILES;
    const { iosRoot, projectRoot } = createRoots(firstSource ? [firstSource] : []);

    expect(copyLivePhotoSourceFiles(projectRoot, iosRoot, 'Noto', false)).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Source file not found:'));
  });
});
