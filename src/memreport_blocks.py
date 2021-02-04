from src.asset_info import *


class TextureMemreportBlock:
    def __init__(self):
        self.starting_token = 'Listing all textures'
        self.starting_offset = 1
        self.info_class = TextureInfo

    @staticmethod
    def line_ends_block(line):
        return line.startswith('Total')


class ObjListMemreportBlock:
    def __init__(self, engine_class_name, info_class):
        self.starting_token = f'Obj List: class={engine_class_name}'
        self.starting_offset = 3
        self.info_class = info_class

    @staticmethod
    def line_ends_block(line):
        return line.isspace()


class SoundMemreportBlock(ObjListMemreportBlock):
    def __init__(self):
        ObjListMemreportBlock.__init__(self, 'SoundWave', SoundWaveInfo)


class AnimSeqMemreportBlock(ObjListMemreportBlock):
    def __init__(self):
        ObjListMemreportBlock.__init__(self, 'AnimSequence', AnimSequenceInfo)

