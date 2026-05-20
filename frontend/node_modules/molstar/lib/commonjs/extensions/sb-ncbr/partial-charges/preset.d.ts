import { StructureRepresentationPresetProvider } from '../../../mol-plugin-state/builder/structure/representation-preset';
export declare const SbNcbrPartialChargesPreset: StructureRepresentationPresetProvider<{
    ignoreHydrogens: boolean | undefined;
    ignoreHydrogensVariant: "all" | "non-polar" | undefined;
    ignoreLight: boolean | undefined;
    quality: "auto" | "medium" | "high" | "low" | "custom" | "highest" | "higher" | "lower" | "lowest" | undefined;
    theme: import("../../../mol-util/param-definition").ParamDefinition.Normalize<{
        globalName: any;
        globalColorParams: any;
        carbonColor: any;
        symmetryColor: any;
        symmetryColorParams: any;
        focus: any;
    }> | undefined;
}, {
    components?: undefined;
    representations?: undefined;
} | {
    components: {
        polymer: import("../../../mol-state").StateObjectSelector<import("../../../mol-plugin-state/objects").PluginStateObject.Molecule.Structure, import("../../../mol-state/transformer").StateTransformer<import("../../../mol-state/object").StateObject<any, import("../../../mol-state/object").StateObject.Type<any>>, import("../../../mol-state/object").StateObject<any, import("../../../mol-state/object").StateObject.Type<any>>, any>> | undefined;
    };
    representations: {
        polymer: import("../../../mol-state").StateObjectSelector<import("../../../mol-plugin-state/objects").PluginStateObject.Molecule.Structure.Representation3D, import("../../../mol-state/transformer").StateTransformer<import("../../../mol-state/object").StateObject<any, import("../../../mol-state/object").StateObject.Type<any>>, import("../../../mol-state/object").StateObject<any, import("../../../mol-state/object").StateObject.Type<any>>, any>>;
    };
} | {
    components: {
        all: import("../../../mol-state").StateObjectSelector<import("../../../mol-plugin-state/objects").PluginStateObject.Molecule.Structure, import("../../../mol-state/transformer").StateTransformer<import("../../../mol-state/object").StateObject<any, import("../../../mol-state/object").StateObject.Type<any>>, import("../../../mol-state/object").StateObject<any, import("../../../mol-state/object").StateObject.Type<any>>, any>> | undefined;
        branched: undefined;
    };
    representations: {
        all: import("../../../mol-state").StateObjectSelector<import("../../../mol-plugin-state/objects").PluginStateObject.Molecule.Structure.Representation3D, import("../../../mol-state/transformer").StateTransformer<import("../../../mol-state/object").StateObject<any, import("../../../mol-state/object").StateObject.Type<any>>, import("../../../mol-state/object").StateObject<any, import("../../../mol-state/object").StateObject.Type<any>>, any>>;
    };
}>;
