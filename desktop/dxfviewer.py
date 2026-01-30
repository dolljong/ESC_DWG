import ezdxf
import numpy as np  # Import numpy for calculations
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Polygon, Arc

import sys,os,copy
# from PIL import Image, ImageDraw


def main():
    if len(sys.argv) < 3:
        print("Usage: {} input.dxf output.png".format(sys.argv[0]))
        sys.exit(1)

    infilename = sys.argv[1]
    outfilename = sys.argv[2]

    if os.path.exists(outfilename):
        sys.exit("Output file {} exists".format(outfilename))

    
    # Read the DXF file
    doc = ezdxf.readfile(infilename)
    msp = doc.modelspace()
    
    # Prepare a matplotlib figure
    fig, ax = plt.subplots()
    ax.set_aspect('equal')
    
    # Iterate through entities in the model space
    for entity in msp:
        if entity.dxftype() == 'LINE':
            draw_line(ax, entity.dxf.start, entity.dxf.end)
        elif entity.dxftype() == 'CIRCLE':
            draw_circle(ax, (-entity.dxf.center.x, entity.dxf.center.y), entity.dxf.radius)
        elif entity.dxftype() == 'LWPOLYLINE':
            draw_lwpolyline(ax, entity)
            #points = entity.get_points(format='xy')
            #draw_lwpolyline(ax, points, entity.closed)
    
    # Set aspect ratio and limits for better visualization
    ax.autoscale_view()
    
    # Save the figure to a PNG file
    plt.savefig(outfilename, dpi=300)
    
    # Optionally, display the plot
    plt.show()
    
    

# Function to draw a circle
def draw_circle(ax, center, radius):
    circle = Circle(center, radius, fill=False, color='black')
    ax.add_patch(circle)

# Function to draw a lightweight polyline (LWPolyline)
def draw_lwpolyline(ax, points, is_closed):
    if is_closed:
        polygon = Polygon(points, closed=True, fill=False, edgecolor='black')
        ax.add_patch(polygon)
    else:
        ax.plot([p[0] for p in points], [p[1] for p in points], 'k-')

# Function to draw a line
def draw_line(ax, start, end):
    ax.plot([start.x, end.x], [start.y, end.y], 'k-')



def add_arc(ax, start, end, bulge):
    # Calculate the arc's radius and center
    dx, dy = end[0] - start[0], end[1] - start[1]
    dist = np.sqrt(dx**2 + dy**2)
    radius = dist * (1 + bulge**2) / (2 * bulge)
    
    # Middle point between start and end
    mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
    
    # Distance from midpoint to arc center
    sagitta = radius - dist / 2 * abs(bulge)
    angle = np.arctan2(dy, dx)
    
    # Determine center of the arc
    if bulge > 0:
        center = [mid[0] + sagitta * np.sin(angle), mid[1] - sagitta * np.cos(angle)]
    else:
        center = [mid[0] - sagitta * np.sin(angle), mid[1] + sagitta * np.cos(angle)]
    
    # Calculate start and end angles
    start_angle = np.degrees(np.arctan2(start[1] - center[1], start[0] - center[0]))
    end_angle = np.degrees(np.arctan2(end[1] - center[1], end[0] - center[0]))
    
    # Arc drawing
    if bulge < 0:
        if start_angle < end_angle:
            start_angle += 360
    else:
        if end_angle < start_angle:
            end_angle += 360

    arc = Arc(center, 2*radius, 2*radius, angle=0, theta1=start_angle, theta2=end_angle, color='black')
    ax.add_patch(arc)


def draw_lwpolyline(ax, entity):
    vertices = entity.get_points(format='xyb')
    for i in range(len(vertices) - 1):
        start, end = vertices[i], vertices[i + 1]
        bulge = start[2]
        if bulge == 0:
            ax.plot([start[0], end[0]], [start[1], end[1]], 'k-')
        else:
            add_arc(ax, start, end, bulge)




def draw_lwpolyline_o2(ax, entity):
    def add_arc(ax, start, end, bulge):
        # Calculate midpoint
        mid = ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)

        # Distance between start and end points
        dist = np.hypot(end[0] - start[0], end[1] - start[1])

        # Radius of the arc
        radius = dist / 2 * (1 + bulge**2) / (2 * bulge)

        # Angle of the line connecting start and end points
        angle = np.arctan2(end[1] - start[1], end[0] - start[0])

        # Distance from midpoint to arc center
        sagitta = radius - dist / 2 * bulge

        # Calculate center of the arc
        center_x = mid[0] + sagitta * np.sin(angle)
        center_y = mid[1] - sagitta * np.cos(angle)

        # Start and end angles
        start_angle = np.arctan2(start[1] - center_y, start[0] - center_x)
        end_angle = np.arctan2(end[1] - center_y, end[0] - center_x)

        # Correct angles for drawing
        if bulge < 0:
            start_angle, end_angle = end_angle, start_angle
        if end_angle < start_angle:
            end_angle += 2 * np.pi

        # Draw the arc
        arc = Arc((center_x, center_y), 2*radius, 2*radius, theta1=np.degrees(start_angle), theta2=np.degrees(end_angle),
                                      color='black', fill=False)
        ax.add_patch(arc)

    vertices = entity.get_points(format='xyb')  # x, y, bulge

    # Draw each segment
    for i in range(len(vertices) - 1):
        start, end = vertices[i], vertices[i + 1]
        bulge = start[2]
        if bulge == 0:
            ax.plot([start[0], end[0]], [start[1], end[1]], 'k-')
        else:
            add_arc(ax, start, end, bulge)

    # Close the polyline if it's closed, considering possible bulge in last segment
    if entity.closed:
        start, end = vertices[-1], vertices[0]
        bulge = start[2]
        if bulge == 0:
            ax.plot([start[0], end[0]], [start[1], end[1]], 'k-')
        else:
            add_arc(ax, start, end, bulge)



def draw_lwpolyline_o(ax, entity):
    vertices = entity.get_points(format='xyb')  # Get vertices and bulges
    for i in range(len(vertices) - 1):
        start, end = vertices[i], vertices[i + 1]
        bulge = start[2]
        if bulge == 0:
            # Draw straight line for segments with no bulge
            ax.plot([start[0], end[0]], [start[1], end[1]], 'k-')
        else:
            # Calculate arc for segments with bulge
            # Arc center, radius, start angle, and end angle calculation
            dx, dy = end[0] - start[0], end[1] - start[1]
            distance = np.hypot(dx, dy)
            radius = distance * (1 + bulge**2) / (4 * bulge)
            angle = np.arctan2(dy, dx)
            center = (start[0] + dx / 2 - radius * np.sin(angle),
                      start[1] + dy / 2 + radius * np.cos(angle))
            start_angle = np.degrees(np.arctan2(start[1] - center[1], start[0] - center[0]))
            end_angle = np.degrees(np.arctan2(end[1] - center[1], end[0] - center[0]))

            # Ensure the arc moves in the correct direction
            if bulge < 0:
                start_angle, end_angle = end_angle, start_angle
            # Correct the angles for drawing
            if end_angle <= start_angle:
                end_angle += 360

            # Draw the arc
            arc = Arc(center, 2*radius, 2*radius, angle=0, theta1=start_angle, theta2=end_angle, color='black')
            ax.add_patch(arc)

    # Close the polyline if it is closed
    if entity.closed:
        start, end = vertices[-1], vertices[0]
        bulge = vertices[-1][2]
        if bulge == 0:
            ax.plot([start[0], end[0]], [start[1], end[1]], 'k-')
        else:
            # Handle the last segment as an arc if needed, similar to above
            pass  # Implement arc drawing for the closing segment if needed


if __name__ == '__main__':
    main()