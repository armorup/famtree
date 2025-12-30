// Data-driven family tree layout engine
// Calculates positions and renders from family_tree.json
// LEFT-TO-RIGHT orientation: oldest on left, youngest on right

const LAYOUT = {
  personWidth: 58,
  personHeight: 78,
  coupleGap: -6,      // Negative = partners overlap/touch (horizontal)
  siblingGap: 12,     // Vertical gap between siblings
  familyGap: 25,      // Vertical gap between family units in same generation
  generationGap: 100, // Horizontal gap between generations
  padding: 20
};

class FamilyTreeLayout {
  constructor(data) {
    this.people = new Map();
    this.families = data.families;
    this.hidden = new Set(data.hidden || []);
    this.positions = new Map();
    this.connections = [];

    // Index people by ID
    data.people.forEach(p => {
      if (!this.hidden.has(p.id)) {
        this.people.set(p.id, p);
      }
    });

    // Build relationships
    this.buildRelationships();
  }

  buildRelationships() {
    // Find each person's family (as child) and family (as parent)
    this.childOf = new Map();  // personId -> family where they're a child
    this.parentIn = new Map(); // personId -> families where they're a partner

    this.families.forEach((fam, idx) => {
      fam.children.forEach(childId => {
        if (!this.hidden.has(childId)) {
          this.childOf.set(childId, fam);
        }
      });
      fam.partners.forEach(partnerId => {
        if (!this.hidden.has(partnerId)) {
          if (!this.parentIn.has(partnerId)) {
            this.parentIn.set(partnerId, []);
          }
          this.parentIn.get(partnerId).push(fam);
        }
      });
    });
  }

  // Main layout calculation
  calculateLayout() {
    // Build family tree with parent-child relationships
    const familyUnits = this.buildFamilyUnits();

    // Calculate heights (for vertical stacking), then position left-to-right
    this.calculateHeights(familyUnits);
    this.positionUnits(familyUnits);

    this.buildConnections();
  }

  // Build family units with their children
  buildFamilyUnits() {
    return {
      // Generation 0: Great-grandparents (roots) - leftmost column
      roots: [
        {
          id: 'ham-popo',
          partners: ['X2', 'X1'],
          childUnits: [
            { id: 'yan-fun', partners: ['F7', 'M11'], childUnits: [], isNephew: true }
          ]
        },
        {
          id: 'peter-cora',
          partners: ['M7', 'M8'],
          childUnits: [
            { id: 'hong', single: 'M1', childUnits: [] },
            { id: 'michelle', single: 'M9', childUnits: [] }
          ]
        },
        {
          id: 'siukee',
          partners: ['X6'],
          childUnits: [
            { id: 'rex', single: 'M2', childUnits: [] }
          ]
        },
        {
          id: 'yehyeh-mama',
          partners: ['X4', 'X5'],
          childUnits: [
            {
              id: 'unclema-auntma',
              partners: ['F3', 'F2'],
              childUnits: [
                {
                  id: 'adrien-ada',
                  partners: ['M3', 'M4'],
                  childUnits: [
                    { id: 'siah', single: 'B3', childUnits: [] }
                  ]
                }
              ]
            },
            {
              id: 'ernest-amy',
              partners: ['F5', 'F6'],
              childUnits: [
                { id: 'stanley-angela', partners: ['B1', 'B2'], childUnits: [] },
                {
                  id: 'wilfred-mary',
                  partners: ['B12', 'B11'],
                  childUnits: [
                    { id: 'zachary', single: 'B6', childUnits: [] },
                    { id: 'xavier', single: 'B8', childUnits: [] },
                    { id: 'sebastian', single: 'B4', childUnits: [] }
                  ]
                },
                {
                  id: 'stewart-mae',
                  partners: ['B10', 'B9'],
                  childUnits: [
                    { id: 'kayley', single: 'B5', childUnits: [] },
                    { id: 'chloe', single: 'B7', childUnits: [] }
                  ]
                }
              ]
            },
            {
              id: 'gooma2',
              single: 'F4',
              childUnits: [
                { id: 'ahfat', single: 'M14', childUnits: [], dashed: true }
              ]
            },
            {
              id: 'gooma3',
              single: 'X3',
              childUnits: [
                {
                  id: 'keith-manyi',
                  partners: ['F1', 'M6'],
                  childUnits: [
                    { id: 'natalie', single: 'M10', childUnits: [] }
                  ]
                },
                { id: 'cherry', single: 'M5', childUnits: [] }
              ]
            }
          ]
        }
      ]
    };
  }

  // Calculate height needed for each unit (including descendants) - for vertical stacking
  calculateHeights(familyUnits) {
    const calcHeight = (unit) => {
      // Base height of this unit (couple or single person)
      let selfHeight = LAYOUT.personHeight;

      // Calculate children total height (stacked vertically)
      if (unit.childUnits && unit.childUnits.length > 0) {
        let childrenHeight = 0;
        unit.childUnits.forEach((child, i) => {
          calcHeight(child);
          childrenHeight += child.totalHeight;
          if (i > 0) childrenHeight += LAYOUT.siblingGap;
        });
        unit.childrenHeight = childrenHeight;
        unit.totalHeight = Math.max(selfHeight, childrenHeight);
      } else {
        unit.childrenHeight = 0;
        unit.totalHeight = selfHeight;
      }
      unit.selfHeight = selfHeight;
    };

    familyUnits.roots.forEach(root => calcHeight(root));
  }

  // Position units: generations go left-to-right, units within generation stack top-to-bottom
  positionUnits(familyUnits) {
    const x = LAYOUT.padding;
    let y = LAYOUT.padding;

    familyUnits.roots.forEach((root, i) => {
      if (i > 0) y += LAYOUT.familyGap;
      this.positionUnit(root, x, y, 0);
      y += root.totalHeight;
    });
  }

  positionUnit(unit, x, y, depth) {
    // Center this unit vertically within its allocated height
    const centerY = y + unit.totalHeight / 2;
    const unitY = centerY - unit.selfHeight / 2;

    // Calculate width of this unit (couple vs single)
    let unitWidth = LAYOUT.personWidth;
    if (unit.partners) {
      const ids = unit.partners.filter(id => this.people.has(id));
      if (ids.length === 2) {
        unitWidth = LAYOUT.personWidth * 2 + LAYOUT.coupleGap;
      }
    }

    // Position this unit's people
    if (unit.partners) {
      const ids = unit.partners.filter(id => this.people.has(id));
      if (ids.length === 2) {
        this.positions.set(ids[0], { x, y: unitY, unitId: unit.id });
        this.positions.set(ids[1], { x: x + LAYOUT.personWidth + LAYOUT.coupleGap, y: unitY, unitId: unit.id });
      } else if (ids.length === 1) {
        this.positions.set(ids[0], { x, y: unitY, unitId: unit.id });
      }
    } else if (unit.single && this.people.has(unit.single)) {
      this.positions.set(unit.single, { x, y: unitY, unitId: unit.id });
    }

    // Position children (to the right)
    if (unit.childUnits && unit.childUnits.length > 0) {
      const childX = x + unitWidth + LAYOUT.generationGap;
      // Center children block vertically relative to parent
      let childY = centerY - unit.childrenHeight / 2;

      unit.childUnits.forEach((child, i) => {
        if (i > 0) childY += LAYOUT.siblingGap;
        this.positionUnit(child, childX, childY, depth + 1);
        childY += child.totalHeight;
      });
    }
  }

  buildConnections() {
    this.connections = [];

    // Parent-child connections
    const familyConnections = [
      { parents: ['X2', 'X1'], children: ['F6'], type: 'normal' },
      { parents: ['M7', 'M8'], children: ['M1', 'M9'], type: 'normal' },
      { parents: ['X6'], children: ['M2'], type: 'normal' },
      { parents: ['X4', 'X5'], children: ['F4', 'F5', 'X3'], type: 'normal' },
      { parents: ['F3', 'F2'], children: ['M4'], type: 'normal' },
      { parents: ['F5', 'F6'], children: ['B1', 'B11', 'B10'], type: 'normal' },
      { parents: ['M3', 'M4'], children: ['B3'], type: 'normal' },
      { parents: ['B12', 'B11'], children: ['B6', 'B8', 'B4'], type: 'normal' },
      { parents: ['B10', 'B9'], children: ['B5', 'B7'], type: 'normal' },
      { parents: ['X3'], children: ['M6', 'M5'], type: 'normal' },
      { parents: ['F1', 'M6'], children: ['M10'], type: 'normal' },
      { parents: ['F4'], children: ['M14'], type: 'dashed' }
    ];

    familyConnections.forEach(conn => {
      const parentPositions = conn.parents
        .filter(id => this.positions.has(id))
        .map(id => this.positions.get(id));

      const childPositions = conn.children
        .filter(id => this.positions.has(id))
        .map(id => ({ id, ...this.positions.get(id) }));

      if (parentPositions.length > 0 && childPositions.length > 0) {
        this.connections.push({
          type: 'parent-child',
          style: conn.type,
          parents: parentPositions,
          children: childPositions
        });
      }
    });

    // Nephew connection (Popo -> Yan)
    if (this.positions.has('X1') && this.positions.has('F7')) {
      this.connections.push({
        type: 'nephew',
        from: this.positions.get('X1'),
        to: this.positions.get('F7')
      });
    }
  }
}

// Render the tree
function renderFlatTree(container, data, style = 'photos') {
  const layout = new FamilyTreeLayout(data);
  layout.calculateLayout();

  // Clear container
  container.innerHTML = '';

  // Create SVG for connections
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('lines');
  svg.setAttribute('id', 'lines');

  // Create people container
  const peopleDiv = document.createElement('div');
  peopleDiv.classList.add('people');
  peopleDiv.setAttribute('id', 'people');

  // Calculate total dimensions
  let maxX = 0, maxY = 0;
  layout.positions.forEach(pos => {
    maxX = Math.max(maxX, pos.x + LAYOUT.personWidth);
    maxY = Math.max(maxY, pos.y + LAYOUT.personHeight);
  });

  // Set container size
  container.style.width = (maxX + LAYOUT.padding) + 'px';
  container.style.height = (maxY + LAYOUT.padding + 20) + 'px';
  svg.style.width = (maxX + LAYOUT.padding) + 'px';
  svg.style.height = (maxY + LAYOUT.padding + 20) + 'px';

  // Render people
  layout.positions.forEach((pos, id) => {
    const person = layout.people.get(id);
    if (!person) return;

    const div = document.createElement('div');
    div.classList.add('person');
    div.setAttribute('id', id.toLowerCase());
    div.style.position = 'absolute';
    div.style.left = pos.x + 'px';
    div.style.top = pos.y + 'px';

    const photo = document.createElement('div');
    photo.classList.add('photo', person.gender === 'M' ? 'male' : 'female');

    // Photo path based on ID
    const photoId = id.toLowerCase();
    if (person.inPhoto !== false) {
      photo.style.backgroundImage = `url('thumbs/${style}/${photoId}.png')`;
    } else {
      photo.classList.add('no-photo');
    }

    const name = document.createElement('div');
    name.classList.add('name');
    // Use first name only, but keep full name for Aunt/Uncle
    const firstName = person.name.split(' ')[0];
    const displayName = (firstName === 'Aunt' || firstName === 'Uncle') ? person.name : firstName;
    name.textContent = displayName;

    div.appendChild(photo);
    div.appendChild(name);

    if (person.chinese) {
      const chinese = document.createElement('div');
      chinese.classList.add('chinese');
      chinese.textContent = person.chinese;
      div.appendChild(chinese);
    }

    if (person.aka) {
      const aka = document.createElement('div');
      aka.classList.add('aka');
      aka.textContent = `(${person.aka})`;
      div.appendChild(aka);
    }

    peopleDiv.appendChild(div);
  });

  container.appendChild(svg);
  container.appendChild(peopleDiv);

  // Draw connections after DOM is ready
  setTimeout(() => drawConnections(svg, layout), 0);

  return layout;
}

function drawConnections(svg, layout) {
  svg.innerHTML = '';

  layout.connections.forEach(conn => {
    if (conn.type === 'parent-child') {
      drawParentChildConnection(svg, conn, layout);
    } else if (conn.type === 'nephew') {
      drawNephewConnection(svg, conn);
    }
  });
}

// Draw horizontal parent-child connections (left-to-right)
function drawParentChildConnection(svg, conn, layout) {
  const parents = conn.parents;
  const children = conn.children;
  const isDashed = conn.style === 'dashed';

  // Calculate parent center point (right edge)
  let parentRightX;
  if (parents.length === 2) {
    parentRightX = Math.max(parents[0].x, parents[1].x) + LAYOUT.personWidth + LAYOUT.coupleGap;
  } else {
    parentRightX = parents[0].x + LAYOUT.personWidth;
  }

  // Parent center Y
  let parentCenterY;
  if (parents.length === 2) {
    parentCenterY = (parents[0].y + parents[1].y) / 2 + LAYOUT.personHeight / 2;
  } else {
    parentCenterY = parents[0].y + LAYOUT.personHeight / 2;
  }

  // Horizontal extension from parent
  const extendX = parentRightX + 15;

  // Calculate bar X (midpoint to children)
  const childLeftX = Math.min(...children.map(c => c.x));
  const barX = extendX + (childLeftX - extendX) / 2;

  // Draw horizontal line from parents
  drawPath(svg, [
    { x: parentRightX, y: parentCenterY },
    { x: extendX, y: parentCenterY }
  ], isDashed ? 'dashed' : '');

  if (children.length === 1) {
    // Single child - elbow
    const childY = children[0].y + LAYOUT.personHeight / 2;
    drawPath(svg, [
      { x: extendX, y: parentCenterY },
      { x: barX, y: parentCenterY },
      { x: barX, y: childY },
      { x: children[0].x, y: childY }
    ], isDashed ? 'dashed' : '');
  } else {
    // Multiple children - vertical bar
    const childYs = children.map(c => c.y + LAYOUT.personHeight / 2);
    const topY = Math.min(...childYs);
    const bottomY = Math.max(...childYs);

    // Horizontal to bar
    drawPath(svg, [
      { x: extendX, y: parentCenterY },
      { x: barX, y: parentCenterY }
    ], isDashed ? 'dashed' : '');

    // Vertical bar
    drawPath(svg, [
      { x: barX, y: topY },
      { x: barX, y: bottomY }
    ], isDashed ? 'dashed' : '');

    // Horizontal lines to each child
    children.forEach(child => {
      const childY = child.y + LAYOUT.personHeight / 2;
      drawPath(svg, [
        { x: barX, y: childY },
        { x: child.x, y: childY }
      ], isDashed ? 'dashed' : '');
    });
  }
}

function drawNephewConnection(svg, conn) {
  const fromX = conn.from.x + LAYOUT.personWidth;
  const fromY = conn.from.y + LAYOUT.personHeight / 2;
  const toX = conn.to.x;
  const toY = conn.to.y + LAYOUT.personHeight / 2;
  const midX = fromX + (toX - fromX) / 2;

  drawPath(svg, [
    { x: fromX, y: fromY },
    { x: midX, y: fromY },
    { x: midX, y: toY },
    { x: toX, y: toY }
  ], 'nephew');
}

function drawPath(svg, points, className = '') {
  if (points.length < 2) return;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  path.setAttribute('d', d);
  if (className) path.setAttribute('class', className);
  svg.appendChild(path);
}

// Export for use in diagram.html
window.FamilyTreeLayout = FamilyTreeLayout;
window.renderFlatTree = renderFlatTree;
