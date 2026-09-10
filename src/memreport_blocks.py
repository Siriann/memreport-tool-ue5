from src.asset_info import *


class TextureMemreportBlock:
    def __init__(self):
        self.starting_token = 'Listing all textures'
        self.starting_offset = 1
        self.column_indexes = None

    def configure_header(self, line):
        columns = split_texture_columns(line)
        self.column_indexes = {
            normalize_texture_column_name(column): index
            for index, column in enumerate(columns)
        }

    def parse_info(self, line):
        if self.column_indexes is None:
            raise ValueError('ListTextures header was not parsed before texture rows')
        return TextureInfo(line, self.column_indexes)

    @staticmethod
    def line_ends_block(line):
        return line.startswith('Total')


class ObjListMemreportBlock:
    def __init__(self, engine_class_name, info_class):
        self.starting_token = f'Obj List: class={engine_class_name}'
        self.starting_offset = 3
        self.info_class = info_class

    def configure_header(self, line):
        # Obj List parsing still uses its whitespace-delimited legacy format.
        pass

    def parse_info(self, line):
        return self.info_class(line)

    @staticmethod
    def line_ends_block(line):
        return line.isspace()


class SoundMemreportBlock(ObjListMemreportBlock):
    def __init__(self):
        ObjListMemreportBlock.__init__(self, 'SoundWave', SoundWaveInfo)


class AnimSeqMemreportBlock(ObjListMemreportBlock):
    def __init__(self):
        ObjListMemreportBlock.__init__(self, 'AnimSequence', AnimSequenceInfo)

