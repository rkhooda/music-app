import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface PlayingBarsProps {
  color: string;
  active: boolean;
  size?: number;
}

/** Three-bar "now playing" indicator; freezes at rest height when paused. */
export const PlayingBars = ({ color, active, size = 16 }: PlayingBarsProps) => {
  const bars = useRef([new Animated.Value(0.4), new Animated.Value(0.8), new Animated.Value(0.55)]).current;

  useEffect(() => {
    if (!active) {
      bars.forEach((bar) => bar.stopAnimation(() => bar.setValue(0.3)));
      return;
    }
    const loops = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 1, duration: 380 + index * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.3, duration: 420 + index * 60, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [active, bars]);

  return (
    <View style={[styles.row, { height: size, width: size }]}>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[styles.bar, { backgroundColor: color, height: size, transform: [{ scaleY: bar }] }]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  bar: { width: 3, borderRadius: 2 },
});
