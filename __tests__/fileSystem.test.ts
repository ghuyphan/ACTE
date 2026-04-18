const mockPathsInfo = jest.fn();

type MockPathState = {
  exists: boolean;
  uri?: string;
  size?: number | null;
  modificationTime?: number | null;
  md5?: string | null;
};

const mockFileStates = new Map<string, MockPathState>();
const mockDirectoryStates = new Map<string, MockPathState>();

function mockGetFileState(uri: string) {
  return mockFileStates.get(uri) ?? { exists: false, uri };
}

function mockGetDirectoryState(uri: string) {
  return mockDirectoryStates.get(uri) ?? { exists: false, uri };
}

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    get exists() {
      return mockGetFileState(this.uri).exists;
    }

    info() {
      const state = mockGetFileState(this.uri);
      return {
        size: state.size ?? null,
        modificationTime: state.modificationTime ?? null,
        md5: state.md5 ?? null,
      };
    }
  }

  class MockDirectory {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    get exists() {
      return mockGetDirectoryState(this.uri).exists;
    }

    info() {
      const state = mockGetDirectoryState(this.uri);
      return {
        size: state.size ?? null,
        modificationTime: state.modificationTime ?? null,
      };
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      info: (...uris: string[]) => mockPathsInfo(...uris),
      document: { uri: 'file:///mock-documents/' },
      cache: { uri: 'file:///mock-cache/' },
      bundle: { uri: 'file:///mock-bundle/' },
    },
  };
});

import { getInfoAsync } from '../utils/fileSystem';

describe('fileSystem.getInfoAsync', () => {
  beforeEach(() => {
    mockPathsInfo.mockReset();
    mockFileStates.clear();
    mockDirectoryStates.clear();
  });

  it('falls back to probing a file when Paths.info reports a file uri as missing', async () => {
    const uri = 'file:///data/user/0/com.acte.app/files/photos/note-1776485338100-8a5a0ec9-dual-primary.jpg';
    mockPathsInfo.mockReturnValue({ exists: false, isDirectory: null });
    mockFileStates.set(uri, {
      exists: true,
      uri,
      size: 1024,
      modificationTime: 123,
      md5: 'abc123',
    });

    await expect(getInfoAsync(uri, { md5: true })).resolves.toEqual({
      exists: true,
      uri,
      isDirectory: false,
      size: 1024,
      modificationTime: 123,
      md5: 'abc123',
    });
  });

  it('falls back to probing a directory when Paths.info throws', async () => {
    const uri = 'file:///data/user/0/com.acte.app/files/photos/';
    mockPathsInfo.mockImplementation(() => {
      throw new Error('Unsupported uri');
    });
    mockDirectoryStates.set(uri, {
      exists: true,
      uri,
      size: 2048,
      modificationTime: 456,
    });

    await expect(getInfoAsync(uri)).resolves.toEqual({
      exists: true,
      uri,
      isDirectory: true,
      size: 2048,
      modificationTime: 456,
    });
  });
});
