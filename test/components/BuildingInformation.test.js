jest.mock('lucide-react-native', () => ({
  ChevronDown: (props) => {
    const React = require('react');
    return React.createElement('ChevronDown', props);
  },
}));

jest.mock('react-native', () => {
  const React = require('react');

  const Animated = {
    Value: function (v) { this._value = v; },
    timing: (val, opts) => ({ start: jest.fn() }),
    View: (props) => React.createElement('AnimatedView', props, props.children),
  };

  return {
    Animated,
    Dimensions: { get: () => ({ height: 800 }) },
    Image: (props) => React.createElement('Image', props, null),
    Pressable: (props) => React.createElement('Pressable', props, props.children),
    ScrollView: (props) => React.createElement('ScrollView', props, props.children),
    StyleSheet: { create: (s) => s },
    Text: (props) => React.createElement('Text', props, props.children),
    View: (props) => React.createElement('View', props, props.children),
  };
});

// Mock React hooks used by the component so we can call the function directly.
jest.mock('react', () => {
  const Actual = jest.requireActual('react');
  return {
    ...Actual,
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn,
    useEffect: (fn) => fn(),
  };
});

describe('components/BuildingInformation', () => {
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
    if (node && node.props && node.props.children) return findByTestID(node.props.children, id);
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
    if (node && node.props && node.props.children === text) return node;
    if (node && node.props && node.props.children) return findTextNode(node.props.children, text);
    return null;
  }

  test('renders title, image and description when provided', () => {
    const path = require('path');
    const BuildingInformation = require(path.join(__dirname, '..', '..', 'components', 'BuildingInformation')).default;

    const onClose = jest.fn();
    const el = BuildingInformation({
      buildingCode: 'B1',
      onClose,
      buildingName: 'My Building',
      buildingInfo: 'This is a test building.',
      buildingPhotoLink: 'http://example.com/photo.jpg',
    });

    const drawer = findByTestID(el, 'building-info-drawer');
    expect(drawer).toBeTruthy();

    const title = findByTestID(el, 'building-info-title');
    expect(title).toBeTruthy();
    expect(title.props.children).toBe('My Building');

    const img = findByTestID(el, 'building-info-content');
    expect(img).toBeTruthy();

    const desc = findByTestID(el, 'building-info-description');
    expect(desc).toBeTruthy();
    expect(desc.props.children).toBe('This is a test building.');
  });

  test('renders fallback description when buildingInfo missing', () => {
    const path = require('path');
    const BuildingInformation = require(path.join(__dirname, '..', '..', 'components', 'BuildingInformation')).default;

    const onClose = jest.fn();
    const el = BuildingInformation({
      buildingCode: 'B1',
      onClose,
      buildingName: 'No Info',
      buildingInfo: undefined,
      buildingPhotoLink: undefined,
    });

    const desc = findByTestID(el, 'building-info-description');
    expect(desc).toBeTruthy();
    expect(desc.props.children).toBe('Building information not available.');
  });

  test('close button calls onClose when pressed', () => {
    const path = require('path');
    const BuildingInformation = require(path.join(__dirname, '..', '..', 'components', 'BuildingInformation')).default;

    const onClose = jest.fn();
    const el = BuildingInformation({
      buildingCode: 'B1',
      onClose,
      buildingName: 'Close Test',
      buildingInfo: 'x',
      buildingPhotoLink: undefined,
    });

    const closeBtn = findByTestID(el, 'building-info-close');
    expect(closeBtn).toBeTruthy();
    // simulate press
    closeBtn.props.onPress();
    expect(onClose).toHaveBeenCalled();
  });
});
