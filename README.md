# memreport-tool
This tool visualizes Unreal Engine memreport file content.

The parser supports the original UE4 memreport format as well as UE5.8 memreports. Texture parsing is driven by the columns reported in each memreport, so UE4 and UE5 layouts can be handled without assuming a fixed column order.

Current status: displaying texture, sound, or animation sequence size information in the form of a nested donut chart (when the corresponding detailed section is present in the memreport).

### Sample reports

- `sample_reports/example.memreport` - UE4 memreport example
- `sample_reports/example_simple.memreport` - simplified UE4 memreport example
- `sample_reports/example_ue5.8.memreport` - full UE5.8 memreport example

### Sample chart

![alt text](screenshot.png)

### Dependencies

Application was created with Python 3.6.

Required packages:

- `anytree`
- `matplotlib`

### Usage
Call `main.py` with parameters:
- `-i <input_filename>` - obligatory: memreport file
- `-c <chart_type>` - obligatory: chart type, one of the following: [`textures`, `sounds`, `animsequences`]
- `-t <size threshold in KB>` - optional: merges items under certain size
