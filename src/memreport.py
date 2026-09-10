from src.filesize.filesize import FileSize
from src.memreport_blocks import *
from src.asset_info_tree import AssetInfoTree


class MemReport:
    asset_types = ['textures', 'sounds', 'animsequences']

    asset_blocks = {'textures': TextureMemreportBlock(), 'sounds': SoundMemreportBlock(), 'animsequences': AnimSeqMemreportBlock()}

    def __init__(self, file_path, asset_type, size_threshold=None):
        self.tree = None
        self.size_threshold = size_threshold
        self.file = open(file_path, 'r', encoding='utf-8', errors='replace')
        self.under_threshold_total_size = FileSize.from_int(0)
        self.parse_file(asset_type)

        self.asset_type_display_name = asset_type
        name_char_list = list(asset_type)
        name_char_list[0] = name_char_list[0].upper()
        self.asset_type_display_name = "".join(name_char_list)

    def parse_file(self, asset_type):
        block_reached = False
        content_found = False
        block_start_line_id = 0

        all_lines = self.file.readlines()

        block = MemReport.asset_blocks[asset_type]

        asset_info_list = []

        for line_id, line in zip(range(len(all_lines)), all_lines):
            if line.startswith(block.starting_token) and not block_reached:
                block_reached = True
                block_start_line_id = line_id + block.starting_offset

                header_line_id = line_id + 1
                if header_line_id < len(all_lines):
                    block.configure_header(all_lines[header_line_id])

            if block_reached and content_found and block.line_ends_block(line):
                break

            if block_reached and line_id > block_start_line_id and not line.isspace():
                info = block.parse_info(line)
                content_found = True
                asset_info_list.append(info)

        if not block_reached:
            raise ValueError('Could not find {} block in memreport'.format(block.starting_token))

        if not asset_info_list:
            raise ValueError('No {} entries found in memreport'.format(asset_type))

        self.tree = AssetInfoTree(asset_info_list)
