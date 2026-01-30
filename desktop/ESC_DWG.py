import ezdxf
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
import tkinter as tk
from tkinter import filedialog, messagebox
import os
import re
import math

from ezdxf.addons.drawing import Frontend, RenderContext
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from ezdxf.enums import TextEntityAlignment

print('Start')

# Configure matplotlib for Korean font support
plt.rcParams['font.family'] = ['Malgun Gothic', 'NanumGothic', 'sans-serif']
plt.rcParams['axes.unicode_minus'] = False

current_dxf_path = None
current_canvas = None
current_toolbar = None
is_maximized = False
script_points = {}  # {name: (x, y)} from last script run

class CustomNavigationToolbar(NavigationToolbar2Tk):
    """Custom navigation toolbar that maintains drawing area size during zoom operations"""

    def __init__(self, canvas, window):
        super().__init__(canvas, window)
        self.canvas = canvas
        self.custom_zoom_start = None

    def press_zoom(self, event):
        """Store the start point for custom zoom behavior"""
        self.custom_zoom_start = (event.x, event.y)
        super().press_zoom(event)

    def drag_zoom(self, event):
        """Override drag to ensure proper rectangle handling"""
        if self._zoom_info is not None:
            try:
                super().drag_zoom(event)
            except AttributeError:
                self._zoom_info = None
                self.custom_zoom_start = None

    def _clear_zoom_artifacts(self, ax):
        """Immediately clear all zoom-related visual artifacts including dashed rectangles"""
        if hasattr(self._zoom_info, 'rectangle') and self._zoom_info.rectangle:
            try:
                self._zoom_info.rectangle.remove()
                self._zoom_info.rectangle = None
            except:
                pass

        patches_to_remove = []
        for patch in list(ax.patches):
            try:
                patch_type = str(type(patch))
                if 'Rectangle' in patch_type:
                    alpha = getattr(patch, 'get_alpha', lambda: 1.0)()
                    linestyle = getattr(patch, 'get_linestyle', lambda: '-')()
                    edgecolor = getattr(patch, 'get_edgecolor', lambda: (0,0,0,1))()
                    facecolor = getattr(patch, 'get_facecolor', lambda: (0,0,0,1))()

                    is_zoom_rect = (
                        linestyle == '--' or
                        linestyle == ':' or
                        alpha < 1.0 or
                        alpha == 0.0 or
                        hasattr(patch, '_selector') or
                        str(patch).find('zoom') >= 0 or
                        (len(facecolor) >= 4 and facecolor[3] < 1.0) or
                        (len(edgecolor) >= 4 and edgecolor[3] < 1.0) or
                        patch.get_fill() == False
                    )

                    if is_zoom_rect:
                        patches_to_remove.append(patch)
            except:
                if 'Rectangle' in str(type(patch)):
                    patches_to_remove.append(patch)

        for patch in patches_to_remove:
            try:
                patch.remove()
            except:
                pass

        artists_to_remove = []
        for artist in list(ax.get_children()):
            try:
                artist_str = str(artist)
                if (hasattr(artist, 'get_linestyle') and
                    (artist.get_linestyle() == '--' or artist.get_linestyle() == ':') and
                    hasattr(artist, 'get_alpha') and
                    artist.get_alpha() < 1.0):
                    artists_to_remove.append(artist)
                elif 'Rectangle' in artist_str and 'patch' in artist_str.lower():
                    artists_to_remove.append(artist)
            except:
                pass

        for artist in artists_to_remove:
            try:
                artist.remove()
            except:
                pass

    def release_zoom(self, event):
        """Override zoom rectangle to maintain drawing area size while changing scale and center"""
        if self._zoom_info is None or self.custom_zoom_start is None:
            return

        start_x, start_y = self.custom_zoom_start
        end_x, end_y = event.x, event.y

        if abs(end_x - start_x) < 5 or abs(end_y - start_y) < 5:
            self._clear_zoom_artifacts(ax)
            self._zoom_info = None
            self.canvas.draw()
            self.custom_zoom_start = None
            return

        ax = self.canvas.figure.axes[0]

        xlim = ax.get_xlim()
        ylim = ax.get_ylim()

        inv = ax.transData.inverted()
        data_coords = inv.transform([(start_x, start_y), (end_x, end_y)])

        data_x1, data_y1 = data_coords[0]
        data_x2, data_y2 = data_coords[1]

        if data_x1 > data_x2:
            data_x1, data_x2 = data_x2, data_x1
        if data_y1 > data_y2:
            data_y1, data_y2 = data_y2, data_y1

        center_x = (data_x1 + data_x2) / 2
        center_y = (data_y1 + data_y2) / 2

        current_width = xlim[1] - xlim[0]
        current_height = ylim[1] - ylim[0]

        rect_width = data_x2 - data_x1
        rect_height = data_y2 - data_y1

        if rect_width <= 0 or rect_height <= 0:
            self._clear_zoom_artifacts(ax)
            self._zoom_info = None
            self.canvas.draw()
            self.custom_zoom_start = None
            return

        zoom_x = current_width / rect_width
        zoom_y = current_height / rect_height

        zoom_factor = min(zoom_x, zoom_y)

        new_width = current_width / zoom_factor
        new_height = current_height / zoom_factor

        new_xlim = [center_x - new_width/2, center_x + new_width/2]
        new_ylim = [center_y - new_height/2, center_y + new_height/2]

        self._clear_zoom_artifacts(ax)

        ax.set_xlim(new_xlim)
        ax.set_ylim(new_ylim)

        self._clear_zoom_artifacts(ax)

        self._zoom_info = None

        self.canvas.draw()

        self.push_current()

        self.custom_zoom_start = None


def save_to_dxf():
    global current_dxf_path
    if not current_dxf_path:
        messagebox.showwarning("No Content", "No content to save.")
        return

    file_path = filedialog.asksaveasfilename(
        defaultextension=".dxf",
        filetypes=[("DXF Files", "*.dxf"), ("All Files", "*.*")]
    )

    if file_path:
        if current_dxf_path and os.path.exists(current_dxf_path):
            doc = ezdxf.readfile(current_dxf_path)
        else:
            doc = ezdxf.new('R2010')

        doc.saveas(file_path)
        messagebox.showinfo("Success", f"DXF file saved successfully to:\n{file_path}")


def save_script():
    """Save the current script text to a .txt file"""
    content = script_text.get("1.0", tk.END).rstrip('\n')
    if not content.strip():
        messagebox.showwarning("Empty Script", "스크립트가 비어 있습니다.")
        return

    file_path = filedialog.asksaveasfilename(
        defaultextension=".txt",
        filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")]
    )
    if file_path:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)


def open_script():
    """Load a script from a .txt file into the editor"""
    file_path = filedialog.askopenfilename(
        filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")]
    )
    if file_path:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        script_text.delete("1.0", tk.END)
        script_text.insert(tk.END, content)

class Point:
    """Named 2D point with .x and .y access, usable in expressions"""
    __slots__ = ('x', 'y')

    def __init__(self, x, y):
        self.x = float(x)
        self.y = float(y)

    def __iter__(self):
        return iter((self.x, self.y))

    def __repr__(self):
        return f'Point({self.x}, {self.y})'


def run_script():
    """Parse the script text box: evaluate variables/points, then create DXF entities and render"""
    global current_dxf_path

    script = script_text.get("1.0", tk.END).strip()
    if not script:
        messagebox.showwarning("Empty Script", "Script is empty.")
        return

    # Safe math functions available in expressions
    safe_builtins = {
        'abs': abs, 'round': round, 'min': min, 'max': max,
        'int': int, 'float': float,
        'sin': math.sin, 'cos': math.cos, 'tan': math.tan,
        'asin': math.asin, 'acos': math.acos, 'atan': math.atan,
        'atan2': math.atan2, 'sqrt': math.sqrt, 'pi': math.pi,
        'radians': math.radians, 'degrees': math.degrees,
        'hypot': math.hypot, 'ceil': math.ceil, 'floor': math.floor,
        'Point': Point,
    }
    variables = dict(safe_builtins)

    # Clear previous error highlights
    script_text.tag_remove('error', '1.0', tk.END)

    doc = ezdxf.new('R2010')
    msp = doc.modelspace()
    entity_count = 0
    errors = []  # list of (line_no, message)

    def safe_eval(expr):
        """Evaluate expression with variables in scope"""
        return eval(expr, {"__builtins__": {}}, variables)

    def resolve_point(token):
        """Resolve a point argument: either a point name or (expr,expr)"""
        token = token.strip()
        # Parenthesised form: (expr, expr)
        m = re.match(r'^\((.+)\)$', token)
        if m:
            inner = m.group(1)
            # Split on comma that is not inside parentheses
            parts = _split_comma_top(inner)
            if len(parts) == 2:
                return tuple(float(safe_eval(p.strip())) for p in parts)
            raise ValueError(f"Expected 2 coordinates, got {len(parts)}: {token}")
        # Named point: evaluate and convert
        val = safe_eval(token)
        if isinstance(val, Point):
            return (val.x, val.y)
        raise ValueError(f"Not a point: {token}")

    def _split_comma_top(s):
        """Split string by top-level commas (not inside parentheses)"""
        depth = 0
        parts = []
        current = []
        for ch in s:
            if ch == '(':
                depth += 1
                current.append(ch)
            elif ch == ')':
                depth -= 1
                current.append(ch)
            elif ch == ',' and depth == 0:
                parts.append(''.join(current))
                current = []
            else:
                current.append(ch)
        parts.append(''.join(current))
        return parts

    def parse_point_args(args_str):
        """Extract list of point arguments from a string.
        Supports: p1 p2           (named points)
                  (0,0) (B,H)     (inline coords)
                  p1 (B,H)        (mixed)
        """
        tokens = []
        i = 0
        s = args_str.strip()
        while i < len(s):
            if s[i] == '(':
                # find matching close paren
                depth = 1
                j = i + 1
                while j < len(s) and depth > 0:
                    if s[j] == '(':
                        depth += 1
                    elif s[j] == ')':
                        depth -= 1
                    j += 1
                tokens.append(s[i:j])
                i = j
            elif s[i] in (' ', '\t'):
                i += 1
            else:
                # read a name token (may contain dots, digits for expressions)
                j = i
                while j < len(s) and s[j] not in (' ', '\t', '('):
                    j += 1
                tokens.append(s[i:j])
                i = j
        return [resolve_point(t) for t in tokens]

    # Entity command keywords (lowercase) to avoid matching as variable assignment
    entity_keywords = {'line', 'circle', 'arc', 'rect', 'polyline', 'pline', 'solid', 'donut', 'text', 'hdim', 'ldim', 'adim'}

    lines = script.split('\n')
    for line_no, raw_line in enumerate(lines, 1):
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue

        try:
            cmd_word = line.split()[0].lower()

            # --- entity commands ---

            # line <pt> <pt>
            if cmd_word == 'line':
                pts = parse_point_args(line[len('line'):])
                if len(pts) < 2:
                    raise ValueError(f"line expects at least 2 points, got {len(pts)}")
                for i in range(len(pts) - 1):
                    msp.add_line(pts[i], pts[i + 1])
                    entity_count += 1
                continue

            # circle <pt> radius
            if cmd_word == 'circle':
                remainder = line[len('circle'):].strip()
                # Split: last token is radius, everything before is point
                # Find the point part first
                if remainder.startswith('('):
                    # (expr,expr) radius
                    depth = 1
                    j = 1
                    while j < len(remainder) and depth > 0:
                        if remainder[j] == '(':
                            depth += 1
                        elif remainder[j] == ')':
                            depth -= 1
                        j += 1
                    pt_str = remainder[:j]
                    r_str = remainder[j:].strip()
                else:
                    # name radius
                    parts = remainder.split()
                    pt_str = parts[0]
                    r_str = ' '.join(parts[1:])
                center = resolve_point(pt_str)
                radius = float(safe_eval(r_str))
                msp.add_circle(center, radius)
                entity_count += 1
                continue

            # arc <pt> radius start_angle end_angle
            if cmd_word == 'arc':
                remainder = line[len('arc'):].strip()
                if remainder.startswith('('):
                    depth = 1
                    j = 1
                    while j < len(remainder) and depth > 0:
                        if remainder[j] == '(':
                            depth += 1
                        elif remainder[j] == ')':
                            depth -= 1
                        j += 1
                    pt_str = remainder[:j]
                    rest = remainder[j:].strip().split()
                else:
                    parts = remainder.split()
                    pt_str = parts[0]
                    rest = parts[1:]
                if len(rest) != 3:
                    raise ValueError(f"arc expects point radius start end, got leftover: {rest}")
                center = resolve_point(pt_str)
                radius = float(safe_eval(rest[0]))
                sa = float(safe_eval(rest[1]))
                ea = float(safe_eval(rest[2]))
                msp.add_arc(center, radius, sa, ea)
                entity_count += 1
                continue

            # rect <pt> <pt>
            if cmd_word == 'rect':
                pts = parse_point_args(line[len('rect'):])
                if len(pts) != 2:
                    raise ValueError(f"rect expects 2 points, got {len(pts)}")
                x1, y1 = pts[0]
                x2, y2 = pts[1]
                msp.add_lwpolyline([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], close=True)
                entity_count += 1
                continue

            # polyline/pline <pt> <pt> <pt> ...
            if cmd_word in ('polyline', 'pline'):
                pts = parse_point_args(line[len(cmd_word):])
                if len(pts) >= 2:
                    msp.add_lwpolyline(pts)
                    entity_count += 1
                continue

            # donut <center> <inner_diameter> <outer_diameter>
            if cmd_word == 'donut':
                remainder = line[len('donut'):].strip()
                if remainder.startswith('('):
                    depth = 1
                    j = 1
                    while j < len(remainder) and depth > 0:
                        if remainder[j] == '(':
                            depth += 1
                        elif remainder[j] == ')':
                            depth -= 1
                        j += 1
                    pt_str = remainder[:j]
                    rest = remainder[j:].strip().split()
                else:
                    parts = remainder.split()
                    pt_str = parts[0]
                    rest = parts[1:]
                if len(rest) != 2:
                    raise ValueError("donut expects: donut <center> <inner_dia> <outer_dia>")
                center = resolve_point(pt_str)
                inner_d = float(safe_eval(rest[0]))
                outer_d = float(safe_eval(rest[1]))
                if outer_d <= inner_d:
                    raise ValueError("outer diameter must be greater than inner diameter")
                cx, cy = center
                w = (outer_d - inner_d) / 2.0
                avg_r = (inner_d + outer_d) / 4.0
                msp.add_lwpolyline(
                    [(cx - avg_r, cy, w, w, 1),
                     (cx + avg_r, cy, w, w, 1)],
                    close=True)
                entity_count += 1
                continue

            # solid <pt1> <pt2> <pt3> [<pt4>]
            if cmd_word == 'solid':
                pts = parse_point_args(line[len('solid'):])
                if len(pts) not in (3, 4):
                    raise ValueError(f"solid expects 3 or 4 points, got {len(pts)}")
                msp.add_solid(pts)
                entity_count += 1
                continue

            # text <pt> [align] height "content"
            # align: 좌우(L,C,R) + 상하(B,M,T)  예: LB, CB, RT, C(=CB)
            if cmd_word == 'text':
                align_map = {
                    'LB': TextEntityAlignment.BOTTOM_LEFT,
                    'CB': TextEntityAlignment.BOTTOM_CENTER,
                    'RB': TextEntityAlignment.BOTTOM_RIGHT,
                    'LM': TextEntityAlignment.MIDDLE_LEFT,
                    'CM': TextEntityAlignment.MIDDLE_CENTER,
                    'RM': TextEntityAlignment.MIDDLE_RIGHT,
                    'LT': TextEntityAlignment.TOP_LEFT,
                    'CT': TextEntityAlignment.TOP_CENTER,
                    'RT': TextEntityAlignment.TOP_RIGHT,
                    # L, C, R only → default vertical B
                    'L': TextEntityAlignment.BOTTOM_LEFT,
                    'C': TextEntityAlignment.BOTTOM_CENTER,
                    'R': TextEntityAlignment.BOTTOM_RIGHT,
                }
                align_pattern = '|'.join(sorted(align_map.keys(), key=len, reverse=True))
                # With alignment: text <pt> AL height "content"
                m = re.match(
                    rf'^text\s+(.+?)\s+({align_pattern})\s+(\S+)\s+"(.+?)"\s*$',
                    line, re.IGNORECASE)
                if m:
                    pos = resolve_point(m.group(1))
                    align = align_map[m.group(2).upper()]
                    height = float(safe_eval(m.group(3)))
                    content = m.group(4)
                    t = msp.add_text(content, dxfattribs={'height': height})
                    t.set_placement(pos, align=align)
                    entity_count += 1
                    continue
                # Without alignment: text <pt> height "content" → default LB
                m = re.match(r'^text\s+(.+?)\s+(\S+)\s+"(.+?)"\s*$', line, re.IGNORECASE)
                if m:
                    pos = resolve_point(m.group(1))
                    height = float(safe_eval(m.group(2)))
                    content = m.group(3)
                    t = msp.add_text(content, dxfattribs={'height': height})
                    t.set_placement(pos, align=TextEntityAlignment.BOTTOM_LEFT)
                    entity_count += 1
                    continue
                raise ValueError('text syntax: text <point> [LB|CB|RB|LM|CM|RM|LT|CT|RT|L|C|R] height "content"')

            # hdim/ldim/adim <pt1> <pt2> <offset>
            if cmd_word in ('hdim', 'ldim', 'adim'):
                remainder = line[len(cmd_word):].strip()
                # Extract two points then the remaining offset expression
                dim_tokens = []
                i = 0
                while i < len(remainder):
                    if remainder[i] == '(':
                        depth = 1
                        j = i + 1
                        while j < len(remainder) and depth > 0:
                            if remainder[j] == '(':
                                depth += 1
                            elif remainder[j] == ')':
                                depth -= 1
                            j += 1
                        dim_tokens.append(remainder[i:j])
                        i = j
                    elif remainder[i] in (' ', '\t'):
                        i += 1
                    else:
                        j = i
                        while j < len(remainder) and remainder[j] not in (' ', '\t', '('):
                            j += 1
                        dim_tokens.append(remainder[i:j])
                        i = j
                if len(dim_tokens) < 3:
                    raise ValueError(f"{cmd_word} expects <pt1> <pt2> <offset>, got {len(dim_tokens)} tokens")
                # Last token is offset, first two are points
                offset_val = float(safe_eval(dim_tokens[-1]))
                # Points: could be 2 tokens (name name) or parenthesised
                pt_tokens = dim_tokens[:-1]
                if len(pt_tokens) != 2:
                    raise ValueError(f"{cmd_word} expects exactly 2 points before offset")
                p1 = resolve_point(pt_tokens[0])
                p2 = resolve_point(pt_tokens[1])
                dist = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
                txt_h = max(dist * 0.04, 1.0)
                override = {'dimtxt': txt_h, 'dimasz': txt_h * 0.6}
                if cmd_word == 'hdim':
                    msp.add_linear_dim(
                        base=(0, p1[1] + offset_val), p1=p1, p2=p2, angle=0,
                        override=override).render()
                elif cmd_word == 'ldim':
                    msp.add_linear_dim(
                        base=(p1[0] + offset_val, 0), p1=p1, p2=p2, angle=90,
                        override=override).render()
                else:  # adim
                    msp.add_aligned_dim(
                        p1=p1, p2=p2, distance=offset_val,
                        override=override).render()
                entity_count += 1
                continue

            # --- assignment: NAME = expression ---
            m = re.match(r'^([A-Za-z_]\w*)\s*=\s*(.+)$', line)
            if m:
                var_name = m.group(1)
                expr_str = m.group(2).strip()

                # Try point assignment: two top-level comma-separated expressions
                parts = _split_comma_top(expr_str)
                if len(parts) == 2:
                    # Could be a point (x_expr, y_expr) or a scalar with comma?
                    # Attempt point first
                    try:
                        px = float(safe_eval(parts[0].strip()))
                        py = float(safe_eval(parts[1].strip()))
                        variables[var_name] = Point(px, py)
                        continue
                    except:
                        pass

                # Scalar variable
                val = safe_eval(expr_str)
                variables[var_name] = val
                continue

            errors.append((line_no, f"Unknown command: {line}"))
        except Exception as e:
            errors.append((line_no, str(e)))

    if errors:
        # Highlight error lines in the text widget
        for err_line, _ in errors:
            script_text.tag_add('error', f'{err_line}.0', f'{err_line}.end')
        # Scroll to first error
        first_err_line = errors[0][0]
        script_text.see(f'{first_err_line}.0')

        msg = "\n".join(f"Line {ln}: {m}" for ln, m in errors)
        messagebox.showerror("Script Errors", msg)
        if entity_count == 0:
            return

    # Collect named points for overlay
    global script_points
    script_points = {}
    for name, val in variables.items():
        if isinstance(val, Point) and name != 'Point':
            script_points[name] = (val.x, val.y)

    # Save to temp file then render via visualize_dxf
    temp_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'Temp', 'dxfviewer_script')
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, '_script_output.dxf')
    doc.saveas(temp_path)

    plt.close('all')
    visualize_dxf(temp_path)
    draw_point_labels()
    print(f"Script executed: {entity_count} entities created")


def draw_point_labels():
    """Overlay point name labels on the current axes if checkbox is checked"""
    if not script_points or not show_points_var.get():
        return

    # Determine label size relative to view extents
    xlim = ax.get_xlim()
    ylim = ax.get_ylim()
    view_size = max(xlim[1] - xlim[0], ylim[1] - ylim[0])
    offset = view_size * 0.012
    fontsize = max(7, min(11, view_size * 0.008))

    for name, (px, py) in script_points.items():
        ax.plot(px, py, 'o', color='#E53935', markersize=5, zorder=10)
        ax.annotate(
            name, (px, py),
            textcoords='offset points', xytext=(4, 4),
            fontsize=fontsize, color='#E53935', fontweight='bold',
            zorder=10,
        )

    current_canvas.draw()


def toggle_point_labels():
    """Redraw when checkbox is toggled"""
    if not current_canvas or not current_dxf_path:
        return
    # Re-run visualize to get clean render, then overlay
    visualize_dxf(current_dxf_path)
    draw_point_labels()


def new_file():
    """Start a new blank file, clearing all state from memory"""
    global current_dxf_path

    current_dxf_path = None

    # Close existing matplotlib figures to free memory
    plt.close('all')

    visualize_dxf()

def toggle_maximize():
    global is_maximized
    is_maximized = not is_maximized

    if is_maximized:
        root.attributes("-fullscreen", True)
        maximize_button.config(text="윈도우 모드", bg="#FFE4B5", fg='black')
    else:
        root.attributes("-fullscreen", False)
        root.state('zoomed')
        maximize_button.config(text="전체화면", bg="white", fg='black')

    root.after(100, lambda: visualize_dxf(current_dxf_path) if current_dxf_path else visualize_dxf())

def setup_clean_axes(ax):
    """Remove ticks, borders, and grid from axes"""
    ax.set_xticks([])
    ax.set_yticks([])
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_visible(False)
    ax.spines['left'].set_visible(False)


def get_optimal_figure_size():
    """Calculate optimal figure size based on available window space"""
    try:
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()

        available_width = screen_width - 320 - 50
        available_height = screen_height - 100

        fig_width = max(12, available_width / 80)
        fig_height = max(8, available_height / 80)

        return (fig_width, fig_height)
    except:
        return (16, 12)

def on_click(event):
    pass

def on_scroll(event):
    global ax
    cur_xlim = ax.get_xlim()
    cur_ylim = ax.get_ylim()
    xdata = event.xdata
    ydata = event.ydata

    if xdata is None or ydata is None:
        return

    if event.button == 'up':
        scale_factor = 0.9
    elif event.button == 'down':
        scale_factor = 1.1
    else:
        scale_factor = 1

    new_width = (cur_xlim[1] - cur_xlim[0]) * scale_factor
    new_height = (cur_ylim[1] - cur_ylim[0]) * scale_factor

    relx = (cur_xlim[1] - xdata) / (cur_xlim[1] - cur_xlim[0])
    rely = (cur_ylim[1] - ydata) / (cur_ylim[1] - cur_ylim[0])

    ax.set_xlim([xdata - new_width * (1 - relx), xdata + new_width * relx])
    ax.set_ylim([ydata - new_height * (1 - rely), ydata + new_height * rely])

    current_canvas.draw()

def visualize_dxf(dxf_file=None):
    global current_dxf_path, current_canvas, current_toolbar, ax

    if current_canvas:
        current_canvas.get_tk_widget().pack_forget()
    if current_toolbar:
        current_toolbar.pack_forget()

    if dxf_file is not None:
        current_dxf_path = dxf_file

        doc = ezdxf.readfile(current_dxf_path)
        msp = doc.modelspace()

        figsize = get_optimal_figure_size()
        current_figure, ax = plt.subplots(figsize=figsize)
        current_figure.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)

        # ezdxf rendering pipeline
        ctx = RenderContext(doc)
        backend = MatplotlibBackend(ax)
        frontend = Frontend(ctx, backend)
        frontend.draw_layout(msp, finalize=True)

        ax.set_aspect('equal')
        setup_clean_axes(ax)

        current_canvas = FigureCanvasTkAgg(current_figure, master=plot_frame)
        current_canvas.mpl_connect('button_press_event', on_click)
        current_canvas.mpl_connect('scroll_event', on_scroll)
        current_canvas.draw()

        current_toolbar = CustomNavigationToolbar(current_canvas, toolbar_frame)
        current_toolbar.update()
        current_toolbar.pack(side=tk.LEFT, fill=tk.X)

        current_canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
    else:
        figsize = get_optimal_figure_size()
        current_figure, ax = plt.subplots(figsize=figsize)
        current_figure.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
        ax.set_aspect('equal')
        setup_clean_axes(ax)

        current_canvas = FigureCanvasTkAgg(current_figure, master=plot_frame)
        current_canvas.mpl_connect('button_press_event', on_click)
        current_canvas.mpl_connect('scroll_event', on_scroll)
        current_canvas.draw()

        current_toolbar = CustomNavigationToolbar(current_canvas, toolbar_frame)
        current_toolbar.update()
        current_toolbar.pack(side=tk.LEFT, fill=tk.X)

        current_canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

def open_file():
    file_path = filedialog.askopenfilename(filetypes=[("DXF Files", "*.dxf")])
    if file_path:
        visualize_dxf(file_path)


def show_usage():
    """Show usage manual in a popup window"""
    usage_win = tk.Toplevel(root)
    usage_win.title("Usage")
    usage_win.geometry("620x580")
    usage_win.resizable(True, True)

    text = tk.Text(usage_win, font=("Consolas", 10), wrap=tk.WORD, padx=15, pady=15)
    scroll = tk.Scrollbar(usage_win, orient=tk.VERTICAL, command=text.yview)
    text.config(yscrollcommand=scroll.set)
    scroll.pack(side=tk.RIGHT, fill=tk.Y)
    text.pack(fill=tk.BOTH, expand=True)

    manual = """\
=== DXF Viewer & Generator 사용법 ===

[파일 메뉴]
  Ctrl+N  새 파일    - 현재 화면을 초기화하고 새로 시작합니다.
  Ctrl+O  열기       - 기존 DXF 파일을 열어 표시합니다.
  Ctrl+S  다른이름저장 - 현재 내용을 새 DXF 파일로 저장합니다.

[화면 조작]
  마우스 휠           - 커서 위치를 중심으로 확대/축소합니다.
  툴바 팬(이동)       - 팬 아이콘 클릭 후 드래그하여 화면을 이동합니다.
  툴바 줌(확대)       - 줌 아이콘 클릭 후 영역을 드래그하여 확대합니다.
  툴바 홈             - 원래 전체 보기로 되돌립니다.

[스크립트 편집기]
  왼쪽 패널의 스크립트 편집기를 사용하여 DXF 도형을
  프로그래밍 방식으로 생성할 수 있습니다.

  1) 변수
     수식에서 사용할 숫자 값을 지정합니다.
       H = 1000
       B = 2000
       r = sqrt(H*H + B*B)

  2) 점(Point)
     이름이 있는 2D 점을 정의합니다.
     좌표는 .x, .y로 접근할 수 있습니다.
       p1 = 0, 0
       p2 = p1.x + B, p1.y
       pc = B/2, H/2

  3) 도형 명령어

     line <점1> <점2> [<점3> ...]
       연속된 점 사이에 직선을 그립니다.
         line p1 p2
         line (0,0) (100,200) (300,400)

     circle <중심점> <반지름>
       원을 그립니다.
         circle pc H/4

     arc <중심점> <반지름> <시작각도> <끝각도>
       호를 그립니다 (각도는 degree 단위).
         arc pc 200 0 90

     rect <점1> <점2>
       두 대각 꼭짓점으로 사각형을 그립니다.
         rect p1 p3
         rect (0,0) (B,H)

     polyline / pline <점1> <점2> <점3> ...
       여러 점을 잇는 폴리라인을 그립니다.
         pline p1 p2 p3 p4

     solid <점1> <점2> <점3> [<점4>]
       채워진 삼각형 또는 사각형을 그립니다.
       3점이면 삼각형, 4점이면 사각형입니다.
         solid p1 p2 p3
         solid p1 p2 p3 p4

     donut <중심점> <내측직경> <외측직경>
       도넛(링) 형태를 그립니다.
         donut pc 100 200
         donut (500,500) 50 150

     text <점> [정렬] <높이> "내용"
       텍스트를 배치합니다.
       정렬 옵션 (생략 시 LB):
         좌우: L(왼쪽) / C(가운데) / R(오른쪽)
         상하: B(아래) / M(중간) / T(위)
       조합 예: LB, CB, RB, LM, CM, RM, LT, CT, RT
         text p1 LT 50 "안녕하세요"
         text pc CM 80 "중앙"

     hdim <점1> <점2> <오프셋>
       수평 치수선을 그립니다.
       오프셋: 양수=위, 음수=아래
         hdim p1 p2 -150

     ldim <점1> <점2> <오프셋>
       수직 치수선을 그립니다.
       오프셋: 양수=오른쪽, 음수=왼쪽
         ldim p2 p3 150

     adim <점1> <점2> <오프셋>
       정렬 치수선을 그립니다 (두 점 방향에 맞춤).
       오프셋: 치수선까지의 수직 거리
         adim p1 p3 100

  4) 수학 함수
     사용 가능: sin, cos, tan, asin, acos, atan, atan2,
     sqrt, pi, radians, degrees, hypot, ceil, floor,
     abs, round, min, max, int, float

  5) 점 이름 표시
     "점 이름 보기" 체크박스를 선택하면 도면 위에
     점 이름이 표시됩니다.

  [Run Script] 버튼을 클릭하면 스크립트가 실행되어
  결과가 화면에 표시됩니다.

[전체화면]
  하단의 "전체화면" 버튼으로 전체화면 모드를 전환합니다.
"""
    text.insert(tk.END, manual)
    text.config(state=tk.DISABLED)

    close_btn = tk.Button(usage_win, text="Close", font=("Arial", 10, "bold"),
                          command=usage_win.destroy, bg='#4CAF50', fg='white')
    close_btn.pack(pady=10)


def show_about():
    """Show About dialog"""
    messagebox.showinfo("About", "DXF Viewer & Generator\nVersion 1.0\n\nA simple DXF viewer and script-based geometry generator.\nBuilt with ezdxf, matplotlib, and tkinter.")


if __name__ == '__main__':
    root = tk.Tk()
    root.title("DXF Viewer & Generator")

    root.state('zoomed')
    is_maximized = False

    font = ("Arial", 10)
    bold_font = ("Arial", 10, "bold")
    bigger_font = ("Arial", 14, "bold")
    small_font = ("Arial", 9)

    main_frame = tk.Frame(root)
    main_frame.pack(fill=tk.BOTH, expand=True)

    control_panel = tk.Frame(main_frame, width=320, bg='#f0f0f0')
    control_panel.pack(side=tk.LEFT, fill=tk.Y)
    control_panel.pack_propagate(False)

    plot_panel = tk.Frame(main_frame)
    plot_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    toolbar_frame = tk.Frame(plot_panel)
    toolbar_frame.pack(side=tk.TOP, fill=tk.X)

    plot_frame = tk.Frame(plot_panel)
    plot_frame.pack(fill=tk.BOTH, expand=True)

    title_label = tk.Label(control_panel, text="DXF Viewer & Generator", font=bigger_font, bg='#f0f0f0', fg='black')
    title_label.pack(pady=10)

    # --- Menu Bar ---
    menubar = tk.Menu(root)
    root.config(menu=menubar)

    file_menu = tk.Menu(menubar, tearoff=0)
    file_menu.add_command(label="New", command=new_file, accelerator="Ctrl+N")
    file_menu.add_command(label="Open DXF...", command=open_file, accelerator="Ctrl+O")
    file_menu.add_command(label="Save as DXF...", command=save_to_dxf, accelerator="Ctrl+S")
    file_menu.add_separator()
    file_menu.add_command(label="Open Script...", command=open_script)
    file_menu.add_command(label="Save Script...", command=save_script)
    file_menu.add_separator()
    file_menu.add_command(label="Close", command=root.quit)
    menubar.add_cascade(label="File", menu=file_menu)

    help_menu = tk.Menu(menubar, tearoff=0)
    help_menu.add_command(label="Usage", command=show_usage)
    help_menu.add_command(label="About", command=show_about)
    menubar.add_cascade(label="Help", menu=help_menu)

    root.bind_all("<Control-n>", lambda e: new_file())
    root.bind_all("<Control-o>", lambda e: open_file())
    root.bind_all("<Control-s>", lambda e: save_to_dxf())

    # Script editor section
    script_frame = tk.LabelFrame(control_panel, text="Script", font=bold_font, bg='#f0f0f0', fg='black')
    script_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

    script_text = tk.Text(script_frame, font=("Consolas", 9), wrap=tk.NONE, undo=True)
    script_text.tag_configure('error', background='#FFCDD2', selectbackground='#EF9A9A')
    script_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=(3, 0))

    # Scrollbars for script text
    script_scroll_y = tk.Scrollbar(script_text, orient=tk.VERTICAL, command=script_text.yview)
    script_scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
    script_text.config(yscrollcommand=script_scroll_y.set)

    script_text.insert(tk.END, """# Variables
H = 1000
B = 2000

# Points: name = x_expr, y_expr
p1 = 0, 0
p2 = p1.x+B, p1.y
p3 = p2.x, p2.y+H
p4 = p1.x, p1.y+H
pc = B/2, H/2

# Entities (use point names or (expr,expr))
rect p1 p3
line p1 p3
line p2 p4
circle pc H/4

# text <pt> [align] height "content"
# align: L,C,R + B,M,T (ex: LB, CT, R)
text p1 LT 50 "p1(LB)"
text p3 RB 50 "p3(RT)"
text pc CM 80 "CENTER"
""")

    script_btn_frame = tk.Frame(script_frame, bg='#f0f0f0')
    script_btn_frame.pack(fill=tk.X, padx=5, pady=5)

    run_button = tk.Button(script_btn_frame, text="Run Script", font=bold_font,
                          command=run_script, bg='#4CAF50', fg='white')
    run_button.pack(side=tk.LEFT, fill=tk.X, expand=True)

    show_points_var = tk.BooleanVar(value=True)
    show_points_cb = tk.Checkbutton(script_btn_frame, text="점 이름 보기", font=small_font,
                                    variable=show_points_var, command=toggle_point_labels,
                                    bg='#f0f0f0', fg='black', selectcolor='#f0f0f0')
    show_points_cb.pack(side=tk.LEFT, padx=(5, 0))

    maximize_button = tk.Button(control_panel, text="전체화면", font=bold_font, command=toggle_maximize, bg='white', fg='black')
    maximize_button.pack(side=tk.BOTTOM, fill=tk.X, padx=10, pady=5)

    visualize_dxf()

    root.mainloop()
