jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: ({ children, ...props }) => React.createElement('LinearGradient', props, children),
  };
});

jest.mock('expo-blur', () => {
  const React = require('react');
  return {
    BlurView: ({ children, ...props }) => React.createElement('BlurView', props, children),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Platform: { OS: 'web' },
    Pressable: (props) => React.createElement('Pressable', props, props.children),
    StyleSheet: { create: (s) => s },
    Text: (props) => React.createElement('Text', props, props.children),
    TextInput: (props) => React.createElement('TextInput', props),
    View: (props) => React.createElement('View', props, props.children),
    useWindowDimensions: () => ({ width: 1000, height: 800 }),
  };
});

describe('components/AppHeader', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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

    if (node && node.props && node.props.testID === id) return node;

    if (node && node.props && node.props.children) {
      return findByTestID(node.props.children, id);
    }

    return null;
  }

  test('renders title and search input with provided value', () => {
    const path = require('path');
    const AppHeader = require(path.join(__dirname, '..', '..', 'components', 'AppHeader')).default;
    const onCampusChange = jest.fn();
    const onSearchTextChange = jest.fn();

    const el = AppHeader({
      campus: 'SGW',
      onCampusChange,
      searchText: 'hello world',
      onSearchTextChange,
    });

    const title = findByTestID(el, 'header-title');
    expect(title).toBeTruthy();
    expect(title.props.children).toBe('Where to?');

    const input = findByTestID(el, 'search-input');
    expect(input).toBeTruthy();
    expect(input.props.value).toBe('hello world');
    expect(input.props.onChangeText).toBe(onSearchTextChange);
  });

  test('campus buttons call onCampusChange with correct value', () => {
    const path = require('path');
    const AppHeader = require(path.join(__dirname, '..', '..', 'components', 'AppHeader')).default;
    const onCampusChange = jest.fn();
    const onSearchTextChange = jest.fn();

    const el = AppHeader({
      campus: 'SGW',
      onCampusChange,
      searchText: '',
      onSearchTextChange,
    });

    const sgw = findByTestID(el, 'campus-toggle-sgw');
    const loy = findByTestID(el, 'campus-toggle-loyola');
    expect(sgw).toBeTruthy();
    expect(loy).toBeTruthy();

    // simulate presses by invoking the onPress prop
    sgw.props.onPress();
    expect(onCampusChange).toHaveBeenCalledWith('SGW');

    loy.props.onPress();
    expect(onCampusChange).toHaveBeenCalledWith('LOY');
  });
});