import { Directory, File, Paths } from 'expo-file-system';

function ensureTrailingSlash(uri: string | null | undefined) {
  if (!uri) {
    return null;
  }

  return uri.endsWith('/') ? uri : `${uri}/`;
}

function getDirectoryUri(getter: () => Directory) {
  try {
    return ensureTrailingSlash(getter().uri);
  } catch {
    return null;
  }
}

function getPathInfo(uri: string) {
  try {
    return Paths.info(uri);
  } catch {
    return {
      exists: false,
      isDirectory: false,
      uri,
    };
  }
}

type EncodingValue = 'utf8' | 'base64';

export const documentDirectory = getDirectoryUri(() => Paths.document);
export const cacheDirectory = getDirectoryUri(() => Paths.cache);
export const bundleDirectory = getDirectoryUri(() => Paths.bundle);

export const EncodingType = {
  UTF8: 'utf8' as EncodingValue,
  Base64: 'base64' as EncodingValue,
};

export type ReadingOptions = {
  encoding?: EncodingValue;
};

export type WritingOptions = {
  encoding?: EncodingValue;
  append?: boolean;
};

export type DeletingOptions = {
  idempotent?: boolean;
};

export type InfoOptions = {
  md5?: boolean;
};

export type RelocatingOptions = {
  from: string;
  to: string;
};

export type MakeDirectoryOptions = {
  intermediates?: boolean;
};

export type FileInfo =
  | {
      exists: true;
      uri: string;
      size?: number | null;
      isDirectory: boolean;
      modificationTime?: number | null;
      md5?: string | null;
    }
  | {
      exists: false;
      uri: string;
      isDirectory: false;
    };

export type FileSystemDownloadResult = {
  uri: string;
  status: number;
  headers: Record<string, string>;
  mimeType: string | null;
  md5?: string | null;
};

export async function getInfoAsync(fileUri: string, options?: InfoOptions): Promise<FileInfo> {
  const pathInfo = getPathInfo(fileUri);
  if (!pathInfo.exists) {
    return {
      exists: false,
      uri: fileUri,
      isDirectory: false,
    };
  }

  if (pathInfo.isDirectory) {
    const directory = new Directory(fileUri);
    const info = directory.info();
    return {
      exists: true,
      uri: fileUri,
      isDirectory: true,
      size: info.size,
      modificationTime: info.modificationTime,
    };
  }

  const file = new File(fileUri);
  const info = file.info(options);
  return {
    exists: true,
    uri: fileUri,
    isDirectory: false,
    size: info.size,
    modificationTime: info.modificationTime,
    md5: info.md5 ?? null,
  };
}

export async function readAsStringAsync(fileUri: string, options?: ReadingOptions): Promise<string> {
  const file = new File(fileUri);
  return options?.encoding === EncodingType.Base64 ? file.base64() : file.text();
}

export async function readAsBytesAsync(fileUri: string): Promise<Uint8Array<ArrayBuffer>> {
  const file = new File(fileUri);
  return file.bytes();
}

export async function readAsArrayBufferAsync(fileUri: string): Promise<ArrayBuffer> {
  const file = new File(fileUri);
  return file.arrayBuffer();
}

export async function writeAsStringAsync(
  fileUri: string,
  contents: string,
  options?: WritingOptions
): Promise<void> {
  const file = new File(fileUri);
  if (!file.exists) {
    file.create({ intermediates: true });
  }

  file.write(contents, {
    encoding: options?.encoding ?? EncodingType.UTF8,
    append: options?.append ?? false,
  });
}

export async function deleteAsync(fileUri: string, options?: DeletingOptions): Promise<void> {
  const pathInfo = getPathInfo(fileUri);
  if (!pathInfo.exists) {
    if (options?.idempotent) {
      return;
    }

    throw new Error(`File or directory does not exist: ${fileUri}`);
  }

  if (pathInfo.isDirectory) {
    new Directory(fileUri).delete();
    return;
  }

  new File(fileUri).delete();
}

export async function moveAsync(options: RelocatingOptions): Promise<void> {
  const sourceInfo = getPathInfo(options.from);
  if (!sourceInfo.exists) {
    throw new Error(`File or directory does not exist: ${options.from}`);
  }

  if (sourceInfo.isDirectory) {
    new Directory(options.from).move(new Directory(options.to));
    return;
  }

  new File(options.from).move(new File(options.to));
}

export async function copyAsync(options: RelocatingOptions): Promise<void> {
  const sourceInfo = getPathInfo(options.from);
  if (!sourceInfo.exists) {
    throw new Error(`File or directory does not exist: ${options.from}`);
  }

  if (sourceInfo.isDirectory) {
    new Directory(options.from).copy(new Directory(options.to));
    return;
  }

  new File(options.from).copy(new File(options.to));
}

export async function makeDirectoryAsync(
  fileUri: string,
  options?: MakeDirectoryOptions
): Promise<void> {
  const directory = new Directory(fileUri);
  directory.create({
    intermediates: options?.intermediates ?? false,
    idempotent: true,
  });
}

export async function readDirectoryAsync(fileUri: string): Promise<string[]> {
  const directory = new Directory(fileUri);
  return directory.list().map((entry) => entry.name);
}

export async function downloadAsync(
  uri: string,
  fileUri: string,
  options?: { headers?: Record<string, string>; md5?: boolean }
): Promise<FileSystemDownloadResult> {
  const destination = new File(fileUri);
  if (destination.exists) {
    destination.delete();
  }

  const file = await File.downloadFileAsync(uri, destination, {
    headers: options?.headers,
    idempotent: true,
  });
  const info = file.info(options?.md5 ? { md5: true } : undefined);

  return {
    uri: file.uri,
    status: 200,
    headers: {},
    mimeType: null,
    md5: info.md5 ?? null,
  };
}
