import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as d3Hexbin from 'd3-hexbin';
import 'remixicon/fonts/remixicon.css';
import './App.css';
import Timeline from './components/Timeline';

interface Process {
  id: string;
  name: string;
  status: string;
  group?: string;
  connections?: string[];
  weight: number;
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  status: string;
  group?: string;
  weight: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: NetworkNode;
  target: NetworkNode;
  value: number;
}

interface Node {
  id: string;
  x: number;
  y: number;
  radius: number;
  hasAnomaly: boolean;
  tag: string;
  properties: {
    name: string;
    type: string;
    status: string;
    processes: Process[];
  };
  date: string;
}

const App: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [expandedProcess, setExpandedProcess] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [currentDate, setCurrentDate] = useState<string>('');
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  // Generate dates for the last 30 days
  const dates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  // Set initial date
  useEffect(() => {
    if (dates.length > 0 && !currentDate) {
      setCurrentDate(dates[dates.length - 1]);
    }
  }, [dates, currentDate]);

  // Filter data based on current date
  const filteredData = useMemo(() => {
    if (!currentDate) return [];
    return nodes.filter(d => d.date === currentDate);
  }, [nodes, currentDate]);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Generate sample data
    const generateNodes = () => {
      const nodes: Node[] = [];
      const groups = {
        'Production': { count: 568, anomalyRate: 0.08 },
        'Staging': { count: 384, anomalyRate: 0.05 },
        'Development': { count: 287, anomalyRate: 0.03 },
        'Testing': { count: 133, anomalyRate: 0.02 },
        'Monitoring': { count: 50, anomalyRate: 0.1 }
      };

      // Generate nodes for each date
      dates.forEach(date => {
        // Calculate total nodes for this date (between 1410 and 1455)
        const totalNodesForDate = Math.floor(Math.random() * (1455 - 1410 + 1)) + 1410;
        
        // Calculate scaling factor to achieve desired total
        const currentTotal = Object.values(groups).reduce((sum, g) => sum + g.count, 0);
        const scaleFactor = totalNodesForDate / currentTotal;

        // Generate nodes for each group
        Object.entries(groups).forEach(([tag, config]) => {
          // Scale the count for this group
          const scaledCount = Math.round(config.count * scaleFactor);
          
          // Create subclusters for better distribution
          const subclusterCount = Math.ceil(scaledCount / 15);
          const subclusters = Array.from({ length: subclusterCount }, () => ({
            centerX: Math.random() * (dimensions.width * 0.6) + (dimensions.width * 0.2),
            centerY: Math.random() * (dimensions.height * 0.6) + (dimensions.height * 0.2),
            radius: Math.min(dimensions.width, dimensions.height) * 0.15
          }));

          // Generate nodes for this group
          for (let i = 0; i < scaledCount; i++) {
            const hasAnomaly = Math.random() < config.anomalyRate;
            const subcluster = subclusters[i % subclusterCount];
            const baseAngle = (i / (scaledCount / subclusterCount)) * Math.PI * 2;
            const angleVariation = (Math.random() - 0.5) * 0.2;
            const angle = baseAngle + angleVariation;
            
            const minDistance = subcluster.radius * (hasAnomaly ? 0.5 : 0.4);
            const maxDistance = subcluster.radius * (hasAnomaly ? 0.8 : 0.9);
            const distance = minDistance + Math.random() * (maxDistance - minDistance);
            
            let x = subcluster.centerX + Math.cos(angle) * distance;
            let y = subcluster.centerY + Math.sin(angle) * distance;

            // Create processes for this node
            const processCount = Math.floor(Math.random() * 100) + 1;
            const nodeProcesses: Process[] = [];
            const problematicProcessCount = hasAnomaly ? Math.floor(Math.random() * 9) + 1 : 0;

            // Create problematic processes
            for (let j = 0; j < problematicProcessCount; j++) {
              const status = j % 2 === 0 ? 'Error' : 'Warning';
              const group = ['Core', 'Network', 'Storage', 'Security', 'Monitoring'][Math.floor(Math.random() * 5)];
              const weight = Math.floor(Math.random() * 3) + 1;
              
              nodeProcesses.push({
                id: `proc-${tag}-${i}-${j}`,
                name: `${group} Process ${j}`,
                status,
                group,
                connections: [],
                weight
              });
            }

            // Create normal processes
            for (let j = problematicProcessCount; j < processCount; j++) {
              const group = ['Core', 'Network', 'Storage', 'Security', 'Monitoring'][Math.floor(Math.random() * 5)];
              const weight = Math.floor(Math.random() * 3) + 1;
              
              nodeProcesses.push({
                id: `proc-${tag}-${i}-${j}`,
                name: `${group} Process ${j}`,
                status: 'OK',
                group,
                connections: [],
                weight
              });
            }

            nodes.push({
              id: `${tag}-${date}-${i}`,
              x,
              y,
              radius: 5,
              hasAnomaly,
              tag,
              properties: {
                name: `${tag} Asset ${i}`,
                type: ['Server', 'Database', 'Service'][Math.floor(Math.random() * 3)],
                status: hasAnomaly ? 'Warning' : 'Active',
                processes: nodeProcesses
              },
              date: date
            });
          }
        });
      });

      return nodes;
    };

    setNodes(generateNodes());
  }, [dimensions, dates]);

  // Update hexbin visualization with zoom transform
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;

    // Clear previous visualization elements
    svg.select('.visualization-layer').selectAll('*').remove();

    // Create a group for the visualization that will be transformed
    const visualizationGroup = svg.select('.visualization-layer')
      .append('g')
      .attr('class', 'visualization-group');

    // Create hexbin generator
    const hexbin = d3Hexbin.hexbin<Node>()
      .x(d => d.x)
      .y(d => d.y)
      .radius(15)
      .extent([[0, 0], [width, height]]);

    // Group nodes by their hexbin
    const bins = hexbin(filteredData);

    // Create color scale for intensity
    const colorScale = d3.scaleLinear<number>()
      .domain([0, 1, 5, 10])
      .range(['#e0e0e0', '#d32f2f', '#b71c1c', '#7f0000']);

    // Draw hexbins
    const hexGroup = visualizationGroup.append('g')
      .attr('class', 'hexbin-group')
      .selectAll<SVGPathElement, d3Hexbin.HexbinBin<Node>>('path')
      .data(bins)
      .enter()
      .append('path')
      .attr('d', hexbin.hexagon())
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .attr('fill', d => {
        const issueCount = d.filter(node => node.hasAnomaly).length;
        return colorScale(issueCount);
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .style('animation-delay', () => `${Math.random() * 3}s`)
      .classed('hexbin-anomaly', d => d.filter(node => node.hasAnomaly).length > 0)
      .on('mouseenter', function(event, d: d3Hexbin.HexbinBin<Node>) {
        // Remove animation class on hover
        d3.select(this).classed('hexbin-anomaly', false);
        d3.select(this)
          .transition()
          .duration(200)
          .attr('fill', () => {
            const issueCount = d.filter(node => node.hasAnomaly).length;
            if (issueCount === 0) {
              return '#2e7d32';
            }
            const baseColor = colorScale(issueCount);
            return d3.color(baseColor)?.darker(0.3).toString() || baseColor;
          });

        // Add text label for suspicious processes count
        const issueCount = d.filter(node => node.hasAnomaly).length;
        if (issueCount > 0) {
          // Find the node with the most suspicious processes
          const nodeWithMostIssues = d.reduce((max, node) => {
            const currentIssues = node.properties.processes.filter(p => p.status !== 'OK').length;
            const maxIssues = max.properties.processes.filter(p => p.status !== 'OK').length;
            return currentIssues > maxIssues ? node : max;
          }, d[0]);
          
          const suspiciousCount = nodeWithMostIssues.properties.processes.filter(p => p.status !== 'OK').length;
          
          visualizationGroup.append('text')
            .attr('class', 'hex-label')
            .attr('x', d.x)
            .attr('y', d.y)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '10px')
            .attr('pointer-events', 'none')
            .text(suspiciousCount);
        }
      })
      .on('mouseleave', function(event, d: d3Hexbin.HexbinBin<Node>) {
        // Restore animation class on mouse leave
        d3.select(this).classed('hexbin-anomaly', d.filter(node => node.hasAnomaly).length > 0);
        d3.select(this)
          .transition()
          .duration(200)
          .attr('fill', () => {
            const issueCount = d.filter(node => node.hasAnomaly).length;
            return colorScale(issueCount);
          });

        // Remove text label
        visualizationGroup.selectAll('.hex-label').remove();
      })
      .on('click', (event, d) => {
        // Prevent event from bubbling up to zoom behavior
        event.stopPropagation();
        
        // Find the node with the most suspicious processes in this bin
        const nodeWithMostIssues = d.reduce((max, node) => {
          const currentIssues = node.properties.processes.filter(p => p.status !== 'OK').length;
          const maxIssues = max.properties.processes.filter(p => p.status !== 'OK').length;
          return currentIssues > maxIssues ? node : max;
        }, d[0]);

        // Select the node (whether it has suspicious processes or not)
        setSelectedNode(nodeWithMostIssues);
      });

    // Add count labels
    hexGroup.append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', d => {
        const issueCount = d.filter(node => node.hasAnomaly).length;
        return issueCount > 0 ? '#ffffff' : '#2e7d32';
      })
      .attr('font-size', '12px')
      .text(d => d.length);

  }, [filteredData, dimensions]);

  // Add zoom behavior
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    
    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .filter((event) => {
        // Only allow wheel events for zooming, disable double-click zoom
        return event.type === 'wheel';
      })
      .on('zoom', (event) => {
        const visualizationGroup = svg.select('.visualization-group');
        visualizationGroup.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Set initial zoom level to 2x and center the view
    const centerX = width / 2;
    const centerY = height / 2;
    const initialTransform = d3.zoomIdentity
      .translate(centerX, centerY)
      .scale(2)
      .translate(-centerX, -centerY);
    
    svg.call(zoom.transform, initialTransform);

    return () => {
      svg.on('.zoom', null);
    };
  }, [dimensions]);

  // Add effect to expand first suspicious process when node is selected
  useEffect(() => {
    if (selectedNode?.hasAnomaly) {
      const firstSuspiciousProcess = selectedNode.properties.processes
        .find(proc => proc.status !== 'OK');
      if (firstSuspiciousProcess) {
        setExpandedProcess(firstSuspiciousProcess.id);
      }
    } else {
      setExpandedProcess(null);
    }
  }, [selectedNode]);

  const renderProcessGraph = (processId: string, containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear previous content
    d3.select(container).selectAll('*').remove();

    const width = container.clientWidth;
    const height = 400;
    const padding = 40;
    const graphWidth = width - (padding * 2);
    const graphHeight = height - (padding * 2);

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('style', 'max-width: 100%; height: auto; background: white; border-radius: 4px;');

    // Create a group for the visualization that will be transformed
    const visualizationGroup = svg.append('g')
      .attr('class', 'visualization-group');

    // Add arrow marker definition
    visualizationGroup.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#999')
      .style('stroke', 'none');

    // Generate sample nodes for the process
    const nodeCount = Math.floor(Math.random() * 6) + 15; // 15-20 nodes
    const graphNodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: `node-${i}`,
      name: `Component ${i}`,
      status: Math.random() > 0.8 ? 'Error' : Math.random() > 0.6 ? 'Warning' : 'OK',
      group: ['Core', 'Network', 'Storage', 'Security', 'Monitoring'][Math.floor(Math.random() * 5)]
    }));

    // Generate random connections
    const links = [];
    for (let i = 0; i < graphNodes.length; i++) {
      const connectionCount = Math.floor(Math.random() * 3) + 1; // 1-3 connections per node
      for (let j = 0; j < connectionCount; j++) {
        const targetIndex = Math.floor(Math.random() * graphNodes.length);
        if (targetIndex !== i) {
          links.push({
            source: graphNodes[i].id,
            target: graphNodes[targetIndex].id,
            value: Math.random() * 3 + 1
          });
        }
      }
    }

    // Create a color scale for groups
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    // Create the force simulation
    const simulation = d3.forceSimulation(graphNodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(40))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.1))
      .force('x', d3.forceX(width / 2).strength(0.1))
      .force('y', d3.forceY(height / 2).strength(0.1))
      .force('collision', d3.forceCollide().radius(10))
      .force('boundary', () => {
        return alpha => {
          graphNodes.forEach(node => {
            node.x = Math.max(padding + 10, Math.min(graphWidth + padding - 10, node.x));
            node.y = Math.max(padding + 10, Math.min(graphHeight + padding - 10, node.y));
          });
        };
      });

    // Create the links
    const link = visualizationGroup.append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.4)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value) * 0.5)
      .attr('marker-end', 'url(#arrowhead)');

    // Create the nodes
    const node = visualizationGroup.append('g')
      .selectAll('circle')
      .data(graphNodes)
      .join('circle')
      .attr('r', 3)
      .attr('fill', d => d.status === 'OK' ? '#2e7d32' : d.status === 'Warning' ? '#ffa000' : '#d32f2f')
      .attr('stroke', d => color(d.group))
      .attr('stroke-width', 1)
      .call(drag(simulation));

    // Add labels
    const label = visualizationGroup.append('g')
      .selectAll('text')
      .data(graphNodes)
      .join('text')
      .text(d => d.name.split(' ')[1])
      .attr('font-size', '6px')
      .attr('fill', '#333')
      .attr('text-anchor', 'middle')
      .attr('dy', -5);

    // Add a legend for groups (outside the visualization group)
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('font-size', 10)
      .attr('text-anchor', 'start')
      .selectAll('g')
      .data(color.domain())
      .join('g')
      .attr('transform', (d, i) => `translate(12,${12 + (i * 16)})`);

    legend.append('rect')
      .attr('x', 0)
      .attr('y', -4)
      .attr('width', 8)
      .attr('height', 8)
      .attr('fill', color);

    legend.append('text')
      .attr('x', 12)
      .attr('y', 1)
      .attr('dominant-baseline', 'middle')
      .text(d => d);

    // Add zoom behavior (mouse wheel only)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .filter((event) => {
        // Only allow wheel events for zooming, disable double-click zoom
        return event.type === 'wheel';
      })
      .on('zoom', (event) => {
        visualizationGroup.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Set initial zoom level to 2x and center the view
    const centerX = width / 2;
    const centerY = height / 2;
    const initialTransform = d3.zoomIdentity
      .translate(centerX, centerY)
      .scale(2)
      .translate(-centerX, -centerY);
    
    svg.call(zoom.transform, initialTransform);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

    // Drag functions
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }
  };

  useEffect(() => {
    if (expandedProcess) {
      // Small delay to ensure DOM element exists
      setTimeout(() => {
        renderProcessGraph(expandedProcess, `process-graph-${expandedProcess}`);
      }, 100);
    }
  }, [expandedProcess]);

  return (
    <div className="app" onClick={(e) => {
      if (e.target === e.currentTarget) {
        setSelectedNode(null);
      }
    }}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ background: 'white' }}
      >
        <g className="visualization-layer" />
        <g className="controls-layer" />
      </svg>
      <div className="total-count">
        <i className="ri-server-line" style={{ color: 'white', marginRight: '8px', fontSize: '16px', verticalAlign: 'middle' }}></i>
        {filteredData.length.toLocaleString()} assets
      </div>
      {selectedNode && (
        <div className={`node-details ${selectedNode.hasAnomaly ? 'anomaly' : ''}`}>
          <div className="close-icon" onClick={() => setSelectedNode(null)} />
          <h1>
            {selectedNode.properties.name}
          </h1>
          <p>
            <i className="ri-hard-drive-line" style={{ color: '#757575', marginRight: '8px', fontSize: '16px', verticalAlign: 'middle' }}></i>
            {selectedNode.properties.type}
          </p>
          <p>
            <i className="ri-price-tag-3-line" style={{ color: '#757575', marginRight: '8px', fontSize: '16px', verticalAlign: 'middle' }}></i>
            {selectedNode.tag}
          </p>
          
          {selectedNode.hasAnomaly ? (
            <>
              <div className="process-summary suspicious">
                <p>Total Processes: {selectedNode.properties.processes.length}</p>
                <p>Suspicious Processes: <span>{
                  selectedNode.properties.processes.filter(p => p.status !== 'OK').length
                }</span></p>
              </div>
              <h3>Suspicious Processes:</h3>
              <ul className="process-list">
                {selectedNode.properties.processes
                  .filter(proc => proc.status !== 'OK')
                  .map(proc => (
                    <li key={proc.id}>
                      <div 
                        className="process-item suspicious"
                        onClick={() => setExpandedProcess(expandedProcess === proc.id ? null : proc.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span style={{ color: proc.status !== 'OK' ? '#d32f2f' : 'inherit', fontWeight: 600 }}>
                          {proc.name} - {proc.status} ({proc.group})
                        </span>
                        <span className="expand-icon">{expandedProcess === proc.id ? '−' : '+'}</span>
                      </div>
                      {expandedProcess === proc.id && (
                        <div className="process-graph-container">
                          <div className="process-actions">
                            <button 
                              className="action-button ignore"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement ignore action
                              }}
                            >
                              <i className="ri-eye-off-fill"></i>
                              <span>Ignore</span>
                            </button>
                            <button 
                              className="action-button whitelist"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement whitelist action
                              }}
                            >
                              <i className="ri-shield-check-fill"></i>
                              <span>Whitelist</span>
                            </button>
                            <button 
                              className="action-button escalate"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement escalate action
                              }}
                            >
                              <i className="ri-alert-fill"></i>
                              <span>Escalate</span>
                            </button>
                          </div>
                          <div id={`process-graph-${proc.id}`} className="process-graph"></div>
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <>
              <div className="process-summary">
                <p>All {selectedNode.properties.processes.length} processes are OK</p>
              </div>
              <h3>Process List:</h3>
              <ul className="process-list">
                {selectedNode.properties.processes
                  .filter(proc => proc.status === 'OK')
                  .map(proc => (
                    <li key={proc.id}>
                      {proc.name} - {proc.status}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      )}
      <Timeline
        dates={dates}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
      />
    </div>
  );
};

export default App; 