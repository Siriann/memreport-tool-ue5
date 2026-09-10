import re

from src.filesize.filesize import FileSize
from src.respath import ResPath


class TextureInfo:
    def __init__(self, text):
        # UE4 reports contained 8 columns. UE5 adds UnknownRef and VT before
        # Usage Count, so parse the common columns and select Usage Count by
        # layout instead of assuming the old fixed index.
        items = [item.strip() for item in text.split(',')]

        if len(items) < 8:
            raise ValueError('Unexpected ListTextures row: {}'.format(text.rstrip()))

        self.dimensions = items[2].split(' ')[0].split('x')

        size_match = re.search(r'\(([0-9.]+)\s*(B|KB|MB|GB)\)', items[2], re.IGNORECASE)
        if not size_match:
            raise ValueError('Could not parse texture size: {}'.format(items[2]))
        self.filesize = FileSize.from_string('{}{}'.format(size_match.group(1), size_match.group(2)))

        self.format = items[3]
        self.tex_group = items[4]
        self.respath = ResPath(items[5])
        self.is_streaming = items[6].upper() == 'YES'

        # UE5: ..., Name, Streaming, UnknownRef, VT, Usage Count, ...
        if len(items) >= 10:
            self.unknown_ref = items[7]
            self.is_virtual_texture = items[8].upper() == 'YES'
            self.usage_count = items[9]
        else:
            self.unknown_ref = None
            self.is_virtual_texture = False
            self.usage_count = items[7]

    def __str__(self):
        return 'Name: {}\nDimensions: {}x{}\nSize: {}\nFormat: {}\nTexGroup: {}\nIsStreaming: {}\nUsages: {}'.format(
            self.respath.chunks[-1], self.dimensions[0], self.dimensions[1],
            str(self.filesize), self.format, self.tex_group, self.is_streaming, self.usage_count)


class AssetInfo:
    def __init__(self, text, filesize_index):
        items = text.split()

        if len(items) <= filesize_index:
            raise ValueError('Unexpected Obj List row: {}'.format(text.rstrip()))

        self.respath = ResPath(items[1])
        self.filesize = FileSize.from_string(items[filesize_index] + 'kb')

    def __str__(self):
        return 'Name {}, Size: {}'.format(self.respath.chunks[-1], str(self.filesize))


class SoundWaveInfo(AssetInfo):
    def __init__(self, text):
        AssetInfo.__init__(self, text, 4)


class AnimSequenceInfo(AssetInfo):
    def __init__(self, text):
        AssetInfo.__init__(self, text, 3)
