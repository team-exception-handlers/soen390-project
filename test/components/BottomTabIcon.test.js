jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const PropTypes = require('prop-types');
  const Ionicons = (props) => React.createElement('Ionicons', { ...props, testID: `ionicon-${props.name}` });
  Ionicons.propTypes = { name: PropTypes.string.isRequired };
  return { Ionicons };
});

jest.mock('react-native', () => {
  const React = require('react');
  const PropTypes = require('prop-types');
  const View = (props) => React.createElement('View', props, props.children);
  View.propTypes = { children: PropTypes.node };
  const Text = (props) => React.createElement('Text', props, props.children);
  Text.propTypes = { children: PropTypes.node };
  return {
    StyleSheet: { create: (s) => s },
    View,
    Text,
  };
});

function findByTestID(node, id) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const res = findByTestID(child, id);
      if (res) return res;
    }
    return null;
  }
  if (node?.props && node.props.testID === id) return node;
  if (node?.props?.children) return findByTestID(node.props.children, id);
  return null;
}

function findByType(node, typeName) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const res = findByType(child, typeName);
      if (res) return res;
    }
    return null;
  }
  if (node && node.type === typeName) return node;
  if (node && typeof node.type === 'function' && node.type.name === typeName) return node;
  if (node?.props && node.props.testID === typeName) return node;
  if (node?.props?.children) return findByType(node.props.children, typeName);
  return null;
}

function findTextNode(node, text) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const res = findTextNode(child, text);
      if (res) return res;
    }
    return null;
  }
  if (node?.props && node.props.children === text) return node;
  if (node?.props?.children) return findTextNode(node.props.children, text);
  return null;
}

describe('components/BottomTabIcon', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('renders map icon and focused color when focused', () => {
    const path = require('node:path');
    const BottomTabIcon = require(path.join(__dirname, '..', '..', 'components', 'BottomTabIcon')).default;

    const el = BottomTabIcon({ focused: true, label: 'Map', type: 'map' });
    // debug output removed

    const icon = findByType(el, 'Ionicons') || findByTestID(el, 'ionicon-map');
    expect(icon).toBeTruthy();
    expect(icon.props.size).toBe(22);
    expect(icon.props.color).toBe('#007AFF');

    const text = findTextNode(el, 'Map');
    expect(text).toBeTruthy();
    const style = text.props.style;
    const styles = Array.isArray(style) ? style : [style];
    expect(styles.some(s => s?.color === '#007AFF')).toBeTruthy();
  });

  test('renders map-outline and unfocused color when not focused', () => {
    const path = require('node:path');
    const BottomTabIcon = require(path.join(__dirname, '..', '..', 'components', 'BottomTabIcon')).default;

    const el = BottomTabIcon({ focused: false, label: 'Map', type: 'map' });

    const icon = findByType(el, 'Ionicons') || findByTestID(el, 'ionicon-map-outline');
    expect(icon).toBeTruthy();
    expect(icon.props.color).toBe('#8E8E93');

    const text = findTextNode(el, 'Map');
    expect(text).toBeTruthy();
    const style = text.props.style;
    const styles = Array.isArray(style) ? style : [style];
    expect(styles.some(s => s?.color === '#8E8E93')).toBeTruthy();
  });

  test('renders person icon for profile type', () => {
    const path = require('node:path');
    const BottomTabIcon = require(path.join(__dirname, '..', '..', 'components', 'BottomTabIcon')).default;

    const el = BottomTabIcon({ focused: true, label: 'Me', type: 'profile' });

    const icon = findByType(el, 'Ionicons') || findByTestID(el, 'ionicon-person');
    expect(icon).toBeTruthy();
    expect(icon.props.color).toBe('#007AFF');
  });

  test('renders person-outline icon when profile not focused', () => {
    const path = require('node:path');
    const BottomTabIcon = require(path.join(__dirname, '..', '..', 'components', 'BottomTabIcon')).default;

    const el = BottomTabIcon({ focused: false, label: 'Me', type: 'profile' });

    const icon = findByType(el, 'Ionicons') || findByTestID(el, 'ionicon-person-outline');
    expect(icon).toBeTruthy();
    expect(icon.props.color).toBe('#8E8E93');
  });

  // ✅ ADDED TESTS BELOW (nothing above changed)

  test('renders calendar icon when focused', () => {
    const path = require('node:path');
    const BottomTabIcon = require(path.join(__dirname, '..', '..', 'components', 'BottomTabIcon')).default;

    const el = BottomTabIcon({ focused: true, label: 'Calendar', type: 'calendar' });

    const icon = findByType(el, 'Ionicons') || findByTestID(el, 'ionicon-calendar');
    expect(icon).toBeTruthy();
    expect(icon.props.size).toBe(22);
    expect(icon.props.color).toBe('#007AFF');

    const text = findTextNode(el, 'Calendar');
    expect(text).toBeTruthy();
    const style = text.props.style;
    const styles = Array.isArray(style) ? style : [style];
    expect(styles.some(s => s?.color === '#007AFF')).toBeTruthy();
  });

  test('renders calendar-outline icon when not focused', () => {
    const path = require('node:path');
    const BottomTabIcon = require(path.join(__dirname, '..', '..', 'components', 'BottomTabIcon')).default;

    const el = BottomTabIcon({ focused: false, label: 'Calendar', type: 'calendar' });

    const icon = findByType(el, 'Ionicons') || findByTestID(el, 'ionicon-calendar-outline');
    expect(icon).toBeTruthy();
    expect(icon.props.size).toBe(22);
    expect(icon.props.color).toBe('#8E8E93');

    const text = findTextNode(el, 'Calendar');
    expect(text).toBeTruthy();
    const style = text.props.style;
    const styles = Array.isArray(style) ? style : [style];
    expect(styles.some(s => s?.color === '#8E8E93')).toBeTruthy();
  });

  test('Text receives numberOfLines=1 and ellipsizeMode="clip"', () => {
    const path = require('node:path');
    const BottomTabIcon = require(path.join(__dirname, '..', '..', 'components', 'BottomTabIcon')).default;

    const el = BottomTabIcon({ focused: false, label: 'Map', type: 'map' });

    const text = findTextNode(el, 'Map');
    expect(text).toBeTruthy();
    expect(text.props.numberOfLines).toBe(1);
    expect(text.props.ellipsizeMode).toBe('clip');
  });
});