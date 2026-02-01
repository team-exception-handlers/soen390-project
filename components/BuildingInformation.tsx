import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type BuildingInformationProps = {
    buildingCode: string | null;
    onClose: () => void;
};

export default function BuildingInformation({
    buildingCode,
    onClose,
}: BuildingInformationProps) {
    // for web rendering
    if (Platform.OS === "web") {

        const panelRef = useRef<View>(null);
        const EXPANDED_HEIGHT = 520;
        const COLLAPSED_HEIGHT = 120;
        const CLOSE_THRESHOLD = 80;

        const heightAnimation = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

        const [isExpanded, setIsExpanded] = useState(false);

        const animateTo = (toValue: number) => {
            Animated.timing(heightAnimation, {
                toValue,
                duration: 220,
                useNativeDriver: false,
            }).start();
        };

        useEffect(() => {
            if (!buildingCode) {
                setIsExpanded(false);
                animateTo(COLLAPSED_HEIGHT);
                return;
            }

            setIsExpanded(true);
            animateTo(EXPANDED_HEIGHT);

            const node = panelRef.current as any;
            node?.scrollIntoView?.({ behavior: "smooth", block: "end" });
        }, [buildingCode]);

        const startHeightRef = useRef(COLLAPSED_HEIGHT);
        const panResponder = useMemo(
            () =>
                PanResponder.create({
                    onMoveShouldSetPanResponder: (_evt, gesture) => {
                        // start dragging if vertical gesture is meaningful
                        return Math.abs(gesture.dy) > 6;
                    },
                    onPanResponderGrant: () => {
                        // capture current animated height as starting point
                        heightAnimation.stopAnimation((value) => {
                            startHeightRef.current = value;
                        });
                    },
                    onPanResponderMove: (_evt, gesture) => {
                        // dragging down decreases height; dragging up increases height
                        const next = startHeightRef.current - gesture.dy;

                        // clamp
                        const clamped = Math.max(COLLAPSED_HEIGHT, Math.min(EXPANDED_HEIGHT, next));
                        heightAnimation.setValue(clamped);
                    },
                    onPanResponderRelease: (_evt, gesture) => {
                        heightAnimation.stopAnimation((current) => {
                            // If dragged down enough from collapsed, close
                            const draggedDownFar =
                                !isExpanded && gesture.dy > CLOSE_THRESHOLD;

                            if (draggedDownFar) {
                                onClose();
                                return;
                            }

                            // Decide snap point based on where you ended
                            const mid = (EXPANDED_HEIGHT + COLLAPSED_HEIGHT) / 2;

                            if (current >= mid) {
                                setIsExpanded(true);
                                animateTo(EXPANDED_HEIGHT);
                            } else {
                                setIsExpanded(false);
                                animateTo(COLLAPSED_HEIGHT);
                            }
                        });
                    },
                }),
            [heightAnimation, isExpanded, onClose],
        );
        if (!buildingCode) return null;

        return (
            <View style={stylesWeb.overlay} pointerEvents="box-none">
                <Animated.View
                    ref={panelRef}
                    style={[stylesWeb.drawer, { height: heightAnimation }]}
                >
                    {/* Handle row (drag area) */}
                    <View style={stylesWeb.handleRow} {...panResponder.panHandlers}>
                        <View style={stylesWeb.handlePill} />
                        <View style={stylesWeb.header}>
                            <Text style={stylesWeb.title}>Building {buildingCode}</Text>

                            <Pressable onPress={onClose} style={stylesWeb.closeBtn}>
                                <Text style={stylesWeb.closeText}>Close</Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Content scroll area */}
                    <ScrollView
                        style={stylesWeb.scroll}
                        contentContainerStyle={stylesWeb.scrollContent}
                    >
                        <Text style={stylesWeb.bodyText}>
                            Put your building details here…
                        </Text>

                        {/* example filler to prove scrolling */}
                        <Text style={stylesWeb.bodyText}>
                            {"\n"}More content…{"\n\n"}More content…{"\n\n"}More content…
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
                        Building {buildingCode}
                    </Text>
                    <Text style={{ fontSize: 14 }}>

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
    handlePill: {
        width: 44,
        height: 5,
        borderRadius: 999,
        backgroundColor: "#D1D1D6",
        alignSelf: "center",
        marginBottom: 10,
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
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: "#F2F2F7",
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
});
