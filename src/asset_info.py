import re

from src.filesize.filesize import FileSize
from src.respath import ResPath


def split_texture_columns(text):
    """Split a ListTextures row/header on commas outside parentheses."""
    columns = []
    current = []
    paren_depth = 0

    for char in text.strip():
        if char == '(':
            paren_depth += 1
        elif char == ')' and paren_depth:
            paren_depth -= 1

        if char == ',' and paren_depth == 0:
            columns.append(''.join(current).strip())
            current = []
        else:
            current.append(char)

    columns.append(''.join(current).strip())
    return columns


def normalize_texture_column_name(name):
    # Dimension columns include a description after ':'. The stable field name
    # is the part before it (for example "Current/InMem").
    name = name.split(':', 1)[0]
    return ''.join(name.lower().split())


class TextureInfo:
    required_columns = ('current/inmem', 'format', 'lodgroup', 'name', 'streaming', 'usagecount')

    def __init__(self, text, column_indexes):
        items = split_texture_columns(text)

        missing_columns = [name for name in self.required_columns if name not in column_indexes]
        if missing_columns:
            raise ValueError('ListTextures header is missing columns: {}'.format(', '.join(missing_columns)))

        max_index = max(column_indexes[name] for name in self.required_columns)
        if len(items) <= max_index:
            raise ValueError('Unexpected ListTextures row: {}'.format(text.rstrip()))

        current_value = items[column_indexes['current/inmem']]
        self.dimensions = current_value.split(' ', 1)[0].split('x')

        size_match = re.search(r'\(([0-9.]+)\s*(B|KB|MB|GB)\)', current_value, re.IGNORECASE)
        if not size_match:
            raise ValueError('Could not parse texture size: {}'.format(current_value))
        self.filesize = FileSize.from_string('{}{}'.format(size_match.group(1), size_match.group(2)))

        self.format = items[column_indexes['format']]
        self.tex_group = items[column_indexes['lodgroup']]
        self.respath = ResPath(items[column_indexes['name']])
        self.is_streaming = items[column_indexes['streaming']].upper() == 'YES'
        self.usage_count = items[column_indexes['usagecount']]

        unknown_ref_index = column_indexes.get('unknownref')
        self.unknown_ref = items[unknown_ref_index] if unknown_ref_index is not None and unknown_ref_index < len(items) else None

        vt_index = column_indexes.get('vt')
        self.is_virtual_texture = (
            items[vt_index].upper() == 'YES'
            if vt_index is not None and vt_index < len(items)
            else False
        )

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
