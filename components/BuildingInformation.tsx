import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ChevronDown } from "lucide-react-native";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
type BuildingInformationProps = {
    buildingCode: string | null;
    onClose: () => void;
    buildingName: string | undefined;
    buildingInfo: string | undefined;
    buildingPhotoLink: string | undefined;
};

export default function BuildingInformation({
    buildingCode,
    onClose,
    buildingName,
    buildingInfo,
    buildingPhotoLink,
}: BuildingInformationProps) {

    // for web rendering
    if (Platform.OS === "web") {

        const panelRef = useRef<View>(null);
        const EXPANDED_HEIGHT = 600;
        const COLLAPSED_HEIGHT = 0;

        const heightAnimation = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

        const animateTo = (toValue: number) => {
            Animated.timing(heightAnimation, {
                toValue,
                duration: 220,
                useNativeDriver: false,
            }).start();
        };

        useEffect(() => {
            if (!buildingCode) {
                animateTo(COLLAPSED_HEIGHT);
                return;
            }

            animateTo(EXPANDED_HEIGHT);

            const node = panelRef.current as any;
            node?.scrollIntoView?.({ behavior: "smooth", block: "end" });
        }, [buildingCode]);

        return (
            <View style={stylesWeb.overlay} pointerEvents="box-none">
                <Animated.View
                    ref={panelRef}
                    style={[stylesWeb.drawer, { height: heightAnimation }]}
                >
                    
                    <View style={stylesWeb.handleRow}>
                        <Pressable onPress={onClose} style={stylesWeb.closeBtn}>
                            <ChevronDown size={24} color= "#8e8e93"/>
                        </Pressable>
                        <View style={stylesWeb.header}>
                            <Text style={stylesWeb.title}>{buildingName}</Text>
                        </View>
                    </View>

                    
                    <ScrollView style={stylesWeb.scroll} contentContainerStyle={stylesWeb.scrollContent}>
                        {buildingPhotoLink ? (<Image style={stylesWeb.image} source={{uri: buildingPhotoLink}} resizeMode="contain" />):null}
                        <Text style={stylesWeb.bodyText}>
                            {buildingInfo ? buildingInfo : "Building information not available."}
                        </Text>
                    </ScrollView>
                </Animated.View>
            </View>
        );
    }

    // for native rendering
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ["50%", "90%"], []);

    useEffect(() => {
        if (buildingCode) bottomSheetRef.current?.expand();
        else bottomSheetRef.current?.close();
    }, [buildingCode]);

    if (!buildingCode) return null;

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={snapPoints}
            enablePanDownToClose
            onClose={onClose}
            backgroundStyle={stylesNative.bottomSheetBackground}
            handleIndicatorStyle={stylesNative.handleIndicator}
        >
            <BottomSheetScrollView contentContainerStyle={stylesNative.contentContainer}>
                <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700" }}>
                        {/*buildingName*/}
                    </Text>
                    <Text style={{ fontSize: 14 }}>
                        {/*buildingInfo*/}
                    </Text>
                </View>
            </BottomSheetScrollView>
        </BottomSheet>
    );
}

const stylesNative = StyleSheet.create({
    bottomSheetBackground: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -4 },
        elevation: 10,
    },
    handleIndicator: {
        backgroundColor: "#D1D1D6",
        width: 40,
        height: 4,
    },
    contentContainer: {
        padding: 16,
    },
});

const stylesWeb = StyleSheet.create({
    overlay: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    drawer: {
        width: "100%",
        maxWidth: 520,
        alignSelf: "center", 
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },

    handleRow: {
        paddingTop: 10,
        paddingHorizontal: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#E5E5EA",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
    },
    closeBtn: {
        alignSelf: "center",
        padding: 4,
        marginBottom: 5,
    },
    closeText: {
        fontSize: 14,
        fontWeight: "600",
    },

    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 14,
        paddingBottom: 22,
    },
    bodyText: {
        fontSize: 14,
        lineHeight: 20,
    },
    image: {
        width: "100%",
        height: 250,
        marginBottom: 14,
    }
});
