export interface ToTsCodeable {
    toTsCode(): TsCode | null;
}

interface TsCodeBuilder {
    sourceOffset: number;
    parentOffset: number;
    children: TsCode[];
    literal: string;
}

interface MapItem {
    sourceOffset: number;
    generatedOffset: number;
    length: number;
}

export class TsCode {
    #sourceOffset: number;
    #parentOffset: number;
    #children: TsCode[];
    #literal: string;
    #shouldBeMapped: boolean;

    constructor(
        sourceOffset: number,
        shouldBeMapped: boolean,
        builder: TsCodeBuilder
    ) {
        this.#sourceOffset = sourceOffset;
        this.#parentOffset = builder.parentOffset;
        this.#children = builder.children;
        this.#literal = builder.literal;
        this.#shouldBeMapped = shouldBeMapped;
    }

    toMappedString(): [MapItem[], string] {
        let generatedCode = "";
        const maps: MapItem[] = [];

        let lastLiteralIndex = 0;
        for (const child of this.#children) {
            generatedCode += this.#literal.slice(
                lastLiteralIndex,
                child.#parentOffset
            );

            lastLiteralIndex = child.#parentOffset;

            const [childMaps, childAsString] = child.toMappedString();

            if (child.#shouldBeMapped) {
                maps.push({
                    sourceOffset: child.#sourceOffset,
                    generatedOffset: generatedCode.length,
                    length: childAsString.length,
                });
            }

            for (const childMap of childMaps) {
                maps.push({
                    ...childMap,
                    generatedOffset:
                        generatedCode.length + childMap.generatedOffset,
                });
            }

            generatedCode += childAsString;
        }

        generatedCode += this.#literal.slice(lastLiteralIndex);

        return [maps, generatedCode];
    }

    get children(): TsCode[] {
        return this.#children;
    }

    set parentOffset(value: number) {
        this.#parentOffset = value;
    }

    static builder(
        literals: TemplateStringsArray,
        ...children: ToTsCodeable[]
    ): TsCodeBuilder {
        const childBuilders: TsCode[] = [];

        let literalOffsetAbove = 0;
        let i = 0;
        while (i < children.length) {
            const child = children[i]!;
            const literal = literals[i]!;

            literalOffsetAbove += literal.length;

            const childAsTsCode = child.toTsCode();
            if (!childAsTsCode) {
                i++;
                continue;
            }

            childAsTsCode.#parentOffset = literalOffsetAbove;
            childBuilders.push(childAsTsCode);

            i++;
        }

        return {
            sourceOffset: 0,
            parentOffset: 0,
            children: childBuilders,
            literal: literals.join(""),
        } satisfies TsCodeBuilder;
    }
}

export class TsCodeArray implements ToTsCodeable {
    #tsCodes: ToTsCodeable[];
    #delimiter: string;

    constructor(tsCodes: ToTsCodeable[], delimiter = "\n") {
        this.#tsCodes = tsCodes;
        this.#delimiter = delimiter;
    }

    toTsCode(): TsCode {
        const children: TsCode[] = [];
        let literal = "";

        for (const tsCode of this.#tsCodes) {
            const asTsCode = tsCode.toTsCode();
            if (!asTsCode) continue;

            asTsCode.parentOffset = literal.length;
            children.push(asTsCode);

            literal += this.#delimiter;
        }

        literal = literal.slice(0, -this.#delimiter.length);

        return new TsCode(0, false, {
            sourceOffset: 0,
            parentOffset: 0,
            children: children,
            literal: literal,
        });
    }
}

