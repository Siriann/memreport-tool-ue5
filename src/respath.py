class ResPath:
    def __init__(self, text):
        self.text = text
        self.chunks = self.parse_text()

    def parse_text(self):
        chunks = self.text.split('/')
        chunks = chunks[1:]

        if not chunks:
            return [self.text]

        last_elem_split = chunks[-1].split('.')
        # UE asset paths normally end in Package.Object, but be tolerant of
        # object/path forms that do not contain a dot.
        if len(last_elem_split) >= 2 and last_elem_split[0] == last_elem_split[1]:
            chunks[-1] = last_elem_split[0]

        return chunks
